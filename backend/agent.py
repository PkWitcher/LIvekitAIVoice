"""
LiveKit AI Voice Agent — Production PSTN Voice Agent
Pipeline: VAD (Silero) → STT (Deepgram Nova-2) → LLM (Groq/OpenAI) → TTS (Deepgram/OpenAI/Sarvam/Cartesia)
Supports inbound and outbound calls via SIP trunks.
"""

import json
import logging
import re
import ssl
import asyncio
import urllib.request
import os
from typing import Optional

import certifi
from dotenv import load_dotenv
from livekit import api, rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.pipeline import VoicePipelineAgent
from livekit.plugins import cartesia, deepgram, elevenlabs, openai, silero

import config

load_dotenv()

logger = logging.getLogger("voice-agent")
logger.setLevel(logging.INFO)


# ──────────────────────────────────────────────
# SSL context for HTTPS calls
# ──────────────────────────────────────────────
ssl_ctx = ssl.create_default_context(cafile=certifi.where())


# ──────────────────────────────────────────────
# Transcript Saver — posts messages to Supabase
# ──────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", os.getenv("NEXT_PUBLIC_SUPABASE_URL", ""))
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    logger.info(f"Transcript saving enabled (URL: {SUPABASE_URL[:30]}...)")
else:
    logger.warning("Transcript saving DISABLED — SUPABASE_URL or SUPABASE_SERVICE_KEY not set")


async def save_transcript(room_name: str, speaker: str, text: str):
    """Save a transcript message to Supabase (non-blocking)."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY or not text.strip():
        logger.debug(f"Transcript skip: url={bool(SUPABASE_URL)}, key={bool(SUPABASE_SERVICE_KEY)}, text='{text[:30] if text else ''}'")
        return
    try:
        url = f"{SUPABASE_URL}/rest/v1/call_transcripts"
        payload = json.dumps({
            "room_name": room_name,
            "speaker": speaker,
            "text": text.strip(),
        }).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Prefer": "return=minimal",
            },
        )
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: urllib.request.urlopen(req, context=ssl_ctx)
        )
        logger.info(f"[TRANSCRIPT] {speaker}: {text.strip()[:60]}")
    except Exception as e:
        logger.warning(f"Transcript save failed: {e}")


# ──────────────────────────────────────────────
# Function Tools
# ──────────────────────────────────────────────
class CallFunctions(llm.FunctionContext):
    """Callable tools exposed to the LLM during conversation."""

    @llm.ai_callable(
        description="Look up a user by their phone number. Returns user info if found."
    )
    async def lookup_user(self, phone: str) -> str:
        """Mock user lookup by phone number."""
        logger.info(f"Looking up user with phone: {phone}")
        mock_db = {
            "+919876543210": {
                "name": "Prashant Kishore",
                "account_id": "ACC-1001",
                "plan": "Premium",
                "language": "en",
            },
            "+919123456789": {
                "name": "Ananya Sharma",
                "account_id": "ACC-1002",
                "plan": "Basic",
                "language": "hi",
            },
            "+918765432100": {
                "name": "Rajesh Kumar",
                "account_id": "ACC-1003",
                "plan": "Enterprise",
                "language": "en",
            },
        }
        user = mock_db.get(phone)
        if user:
            return json.dumps(user)
        return json.dumps({"error": "User not found", "phone": phone})

    @llm.ai_callable(
        description=(
            "Transfer the current call to another phone number or a human agent. "
            "Use this when the caller asks to speak with a human or be transferred."
        )
    )
    async def transfer_call(
        self,
        destination: str,
    ) -> str:
        """Transfer current call via SIP REFER."""
        logger.info(f"Transferring call to: {destination}")

        if not destination:
            destination = config.DEFAULT_TRANSFER_NUMBER

        # Build SIP URI
        if destination.startswith("sip:"):
            sip_uri = destination
        elif destination.startswith("tel:"):
            number = destination.replace("tel:", "")
            sip_uri = f"sip:{number}@{config.SIP_DOMAIN}"
        elif destination.startswith("+") or destination.isdigit():
            sip_uri = f"sip:{destination}@{config.SIP_DOMAIN}"
        else:
            sip_uri = f"sip:{destination}@{config.SIP_DOMAIN}"

        logger.info(f"SIP REFER URI: {sip_uri}")

        return json.dumps({
            "status": "transfer_initiated",
            "destination": sip_uri,
            "message": f"Call is being transferred to {destination}. Please hold.",
        })


# ──────────────────────────────────────────────
# Provider Factories
# ──────────────────────────────────────────────
def create_stt() -> deepgram.STT:
    """Create Deepgram STT instance."""
    return deepgram.STT(
        model=config.STT_MODEL,
        language=config.STT_LANGUAGE,
    )


def create_llm_plugin(provider: str = None) -> openai.LLM:
    """Create LLM instance based on provider name."""
    provider = provider or config.DEFAULT_LLM_PROVIDER
    provider_cfg = config.LLM_PROVIDERS.get(provider, config.LLM_PROVIDERS[config.DEFAULT_LLM_PROVIDER])

    import os
    api_key = os.getenv(provider_cfg["api_key_env"], "")

    if not api_key and provider == "groq":
        logger.warning("Groq API key not found, falling back to OpenAI")
        provider = "openai"
        provider_cfg = config.LLM_PROVIDERS["openai"]
        api_key = os.getenv(provider_cfg["api_key_env"], "")

    return openai.LLM(
        model=provider_cfg["model"],
        api_key=api_key,
        base_url=provider_cfg["base_url"],
        temperature=provider_cfg.get("temperature", 0.7),
    )


def create_tts(provider: str = None, voice_id: str = None, language: str = None):
    """Create TTS instance based on provider and voice."""
    # Auto-detect provider from voice name — but ONLY for known prefixes
    OPENAI_VOICES = {"alloy", "echo", "shimmer", "nova", "fable", "onyx"}
    ELEVENLABS_VOICE_IDS = set(config.TTS_PROVIDERS.get("elevenlabs", {}).get("voices", {}).values())
    if voice_id:
        if voice_id.startswith("aura-"):
            provider = "deepgram"
        elif voice_id in OPENAI_VOICES:
            provider = "openai"
        elif voice_id in ELEVENLABS_VOICE_IDS or (len(voice_id) >= 20 and len(voice_id) <= 24 and voice_id.isalnum()):
            provider = "elevenlabs"
        # NOTE: Do NOT auto-detect Cartesia by UUID — it fails silently without valid key
    provider = provider or config.DEFAULT_TTS_PROVIDER

    logger.info(f"TTS provider: {provider}, voice: {voice_id}")

    if provider == "cartesia":
        import os
        cartesia_key = os.getenv("CARTESIA_API_KEY", "").strip()
        if not cartesia_key or len(cartesia_key) < 10:
            logger.warning("CARTESIA_API_KEY missing or invalid, falling back to Deepgram TTS")
            provider = "deepgram"
            voice_id = None

    if provider == "cartesia":
        import os
        voice = voice_id or config.TTS_PROVIDERS["cartesia"]["default_voice"]
        cartesia_key = os.getenv("CARTESIA_API_KEY", "").strip()
        logger.info(f"Cartesia config: voice={voice}, key_len={len(cartesia_key)}")
        
        try:
            tts_instance = cartesia.TTS(
                voice=voice,
                api_key=cartesia_key,
                sample_rate=24000,
            )
            logger.info("Cartesia TTS created with sample_rate=24000")
            return tts_instance
        except TypeError:
            # Older plugin version doesn't support sample_rate
            try:
                tts_instance = cartesia.TTS(
                    voice=voice,
                    api_key=cartesia_key,
                )
                logger.info("Cartesia TTS created (default params)")
                return tts_instance
            except Exception as e2:
                logger.error(f"Cartesia TTS failed: {e2}")
                voice = config.TTS_PROVIDERS["deepgram"]["default_voice"]
                return deepgram.TTS(model=voice)
        except Exception as e:
            logger.error(f"Cartesia TTS error: {e}")
            voice = config.TTS_PROVIDERS["deepgram"]["default_voice"]
            return deepgram.TTS(model=voice)
    elif provider == "openai":
        voice = voice_id or config.TTS_PROVIDERS["openai"]["default_voice"]
        return openai.TTS(
            model=config.TTS_PROVIDERS["openai"].get("model", "tts-1"),
            voice=voice,
        )
    elif provider == "elevenlabs":
        import os
        eleven_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        if not eleven_key:
            logger.warning("ELEVENLABS_API_KEY not set, falling back to Deepgram TTS")
            voice = config.TTS_PROVIDERS["deepgram"]["default_voice"]
            return deepgram.TTS(model=voice)
        voice = voice_id or config.TTS_PROVIDERS["elevenlabs"]["default_voice"]
        model_id = config.TTS_PROVIDERS["elevenlabs"].get("model", "eleven_multilingual_v2")
        logger.info(f"Creating ElevenLabs TTS: voice={voice}, model={model_id}")
        # The plugin requires a Voice object with an 'id' attribute
        try:
            voice_obj = elevenlabs.Voice(id=voice)
        except (AttributeError, TypeError):
            # Fallback: create a simple object with .id attribute
            class _Voice:
                def __init__(self, vid):
                    self.id = vid
                    self.name = ""
                    self.category = ""
                    self.settings = None
            voice_obj = _Voice(voice)
        try:
            return elevenlabs.TTS(
                voice=voice_obj,
                model=model_id,
                api_key=eleven_key,
            )
        except Exception as e:
            logger.error(f"ElevenLabs TTS creation failed: {e}, falling back to Deepgram")
            voice = config.TTS_PROVIDERS["deepgram"]["default_voice"]
            return deepgram.TTS(model=voice)
    elif provider == "deepgram":
        voice = voice_id or config.TTS_PROVIDERS["deepgram"]["default_voice"]
        valid_voices = config.TTS_PROVIDERS["deepgram"]["voices"]
        if voice not in valid_voices and voice not in valid_voices.values():
            logger.warning(f"Invalid Deepgram voice '{voice}', using default")
            voice = config.TTS_PROVIDERS["deepgram"]["default_voice"]
        return deepgram.TTS(model=voice)
    else:
        voice = voice_id or config.TTS_PROVIDERS["deepgram"]["default_voice"]
        return deepgram.TTS(model=voice)


# ──────────────────────────────────────────────
# Room Metadata Parser
# ──────────────────────────────────────────────
def parse_room_metadata(metadata: Optional[str]) -> dict:
    """Parse JSON room metadata safely."""
    if not metadata:
        return {}
    try:
        return json.loads(metadata)
    except (json.JSONDecodeError, TypeError):
        logger.warning(f"Failed to parse room metadata: {metadata}")
        return {}


# ──────────────────────────────────────────────
# Extract Greeting from Custom Prompt
# ──────────────────────────────────────────────

def extract_greeting_from_prompt(prompt: str) -> Optional[str]:
    """Extract the greeting from a structured call prompt.
    
    Handles multiple formats:
      1. Greet: "Namaste! Main Arjun bol raha hoon..."
      ## PEHLI BAAT
      "Hello! Main Arjun bol raha hoon..."
      CALL FLOW:
      1. "Hello!..."
    """
    if not prompt:
        return None

    lines = prompt.split('\n')

    # Pattern 1: Find "PEHLI BAAT" / "FIRST" / "GREETING" / "OPENING" header, then grab next quoted text
    greeting_headers = [
        r'PEHLI\s*BAAT', r'FIRST\s*(?:LINE|MESSAGE|THING)', r'GREETING', 
        r'OPENING', r'CALL\s*(?:CONNECT|START)', r'SHURUAT',
    ]
    header_pattern = re.compile(r'(?:##?\s*)?(?:' + '|'.join(greeting_headers) + r')', re.IGNORECASE)
    for i, line in enumerate(lines):
        if header_pattern.search(line):
            # Look at this line and the next few lines for quoted text
            for j in range(i, min(i + 4, len(lines))):
                quote_match = re.search(r'["\u201c]([^"\u201d]{10,})["\u201d]', lines[j])
                if quote_match:
                    return quote_match.group(1).strip()

    # Pattern 2: Look for "1. Greet:" or "1." with quoted text
    match = re.search(r'1\.\s*(?:Greet(?:ing)?:?\s*)?["\u201c]([^"\u201d]+)["\u201d]', prompt)
    if match:
        return match.group(1).strip()

    # Pattern 3: Look for numbered step 1 line with any quoted text
    for line in lines:
        line_stripped = line.strip()
        if re.match(r'^1\.', line_stripped):
            quote_match = re.search(r'["\u201c]([^"\u201d]+)["\u201d]', line_stripped)
            if quote_match:
                return quote_match.group(1).strip()
            text_match = re.match(r'^1\.\s*(?:Greet(?:ing)?:?\s*)?(.+)', line_stripped)
            if text_match:
                text = text_match.group(1).strip().strip('"\'')
                if len(text) > 5:
                    return text

    # Pattern 4: Look for "Greet:" anywhere
    greet_match = re.search(r'Greet(?:ing)?:\s*["\u201c]?([^"\u201d\n]+)["\u201d]?', prompt)
    if greet_match:
        return greet_match.group(1).strip()

    # Pattern 5: Find the first quoted text longer than 15 chars (likely a greeting)
    first_quote = re.search(r'["\u201c]([^"\u201d]{15,})["\u201d]', prompt)
    if first_quote:
        text = first_quote.group(1).strip()
        # Only use if it sounds like a greeting (contains hello/namaste/hi/main)
        if re.search(r'(?:hello|namaste|hi|main.*bol|this is|hey)', text, re.IGNORECASE):
            return text

    return None


# ──────────────────────────────────────────────
# Outbound Dialing
# ──────────────────────────────────────────────
async def dial_outbound(ctx: JobContext, phone_number: str, metadata: dict) -> None:
    """Create a SIP participant to dial out via the configured SIP trunk."""
    logger.info(f"Dialing outbound to {phone_number} via trunk {config.SIP_TRUNK_ID}")

    if not config.SIP_TRUNK_ID:
        logger.error("SIP_TRUNK_ID not configured — cannot dial outbound")
        return

    lk_api = api.LiveKitAPI(
        url=config.LIVEKIT_URL,
        api_key=config.LIVEKIT_API_KEY,
        api_secret=config.LIVEKIT_API_SECRET,
    )

    try:
        await lk_api.sip.create_sip_participant(
            api.CreateSIPParticipantRequest(
                sip_trunk_id=config.SIP_TRUNK_ID,
                sip_call_to=phone_number,
                room_name=ctx.room.name,
                participant_identity=f"phone-{phone_number}",
                participant_name=f"Caller {phone_number}",
            )
        )
        logger.info(f"SIP participant created for {phone_number}")
    except Exception as e:
        logger.error(f"Failed to dial {phone_number}: {e}")
    finally:
        await lk_api.aclose()


# ──────────────────────────────────────────────
# Prewarm — load models once at startup
# ──────────────────────────────────────────────
def prewarm(proc: JobProcess) -> None:
    """Preload VAD model to avoid cold-start delay."""
    proc.userdata["vad"] = silero.VAD.load(
        min_silence_duration=config.VAD_MIN_SILENCE_DURATION,
        prefix_padding_duration=config.VAD_PADDING_DURATION,
        activation_threshold=config.VAD_THRESHOLD,
    )
    logger.info("VAD model prewarmed")


# ──────────────────────────────────────────────
# Agent Entrypoint
# ──────────────────────────────────────────────
async def entrypoint(ctx: JobContext) -> None:
    """Main agent entrypoint — runs per room."""
    logger.info(f"Agent joining room: {ctx.room.name}")

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Parse room metadata for runtime config
    # Retry reading metadata — it may arrive after the agent joins (race condition with LiveKit Cloud)
    metadata = {}
    for attempt in range(2):
        raw = ctx.room.metadata
        if raw:
            metadata = parse_room_metadata(raw)
            break
        await asyncio.sleep(0.25)

    phone_number = metadata.get("phone_number")
    model_provider = metadata.get("model_provider", config.DEFAULT_LLM_PROVIDER)
    voice_id = metadata.get("voice_id", config.DEFAULT_VOICE_ID)
    tts_provider = metadata.get("tts_provider", config.DEFAULT_TTS_PROVIDER)
    custom_prompt = metadata.get("prompt", "")
    stt_language = metadata.get("language", config.STT_LANGUAGE)

    logger.info(
        f"Config — LLM: {model_provider}, TTS: {tts_provider}, "
        f"Voice: {voice_id}, Lang: {stt_language}, Phone: {phone_number}"
    )

    # Build system prompt
    if custom_prompt:
        system_prompt = custom_prompt + """

IMPORTANT RULES:
- Keep responses SHORT (1-2 sentences max).
- Follow the call flow steps in order.
- Wait for customer to respond before asking next question.
- If customer asks something not in your script, say you will check and get back.
- Never make up information. Never be pushy."""
    else:
        system_prompt = config.SYSTEM_PROMPT

    # Determine if inbound (user already in room) or outbound
    existing_participants = ctx.room.remote_participants
    is_inbound = len(existing_participants) > 0

    if is_inbound:
        logger.info("Inbound call detected — user already in room")
        greeting = config.INBOUND_GREETING
    elif custom_prompt:
        # Extract greeting from prompt — use same path as default greeting
        extracted = extract_greeting_from_prompt(custom_prompt)
        greeting = extracted or "Hello!"
        logger.info(f"Custom prompt greeting: {greeting[:50]}")
    else:
        greeting = config.INITIAL_GREETING

    # Add strict language consistency enforcement
    lang_names = {
        "hi": "Hindi", "en": "English", "ta": "Tamil", "te": "Telugu",
        "bn": "Bengali", "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada",
        "ml": "Malayalam", "pa": "Punjabi", "multi": None,
    }
    target_lang = lang_names.get(stt_language)
    if target_lang:
        system_prompt += f"\n\nCRITICAL LANGUAGE RULE: You MUST speak ONLY in {target_lang}. Your very FIRST sentence and ALL responses must be in {target_lang}. NEVER use English unless the customer speaks English first. This is non-negotiable."
    else:
        system_prompt += "\n\nCRITICAL LANGUAGE RULE: Detect the caller's language from their FIRST sentence. Then speak ONLY in that language for the entire call. NEVER switch mid-call."

    # Create pipeline components
    fnc_ctx = CallFunctions() if not custom_prompt else None
    stt = deepgram.STT(
        model=config.STT_MODEL,
        language=stt_language,
    )
    llm_plugin = create_llm_plugin(model_provider)
    tts = create_tts(tts_provider, voice_id, stt_language)
    logger.info(f"TTS provider resolved: {type(tts).__module__}.{type(tts).__name__}")

    initial_ctx = llm.ChatContext()
    initial_ctx.append(role="system", text=system_prompt)

    # Build the voice pipeline agent
    agent = VoicePipelineAgent(
        vad=ctx.proc.userdata["vad"],
        stt=stt,
        llm=llm_plugin,
        tts=tts,
        fnc_ctx=fnc_ctx,
        chat_ctx=initial_ctx,
    )

    # Dial outbound if phone_number specified and no one is in the room yet
    if phone_number and not is_inbound:
        logger.info(f"Dialing outbound to {phone_number}")
        await dial_outbound(ctx, phone_number, metadata)

    # Start the agent
    agent.start(ctx.room)
    logger.info("Agent pipeline started")

    # ── Live Transcript: capture user & AI speech events ──
    # Wrapped in try/except to never interfere with the voice pipeline
    room_name_for_transcript = ctx.room.name

    def extract_text(msg) -> str:
        """Extract text from various message types."""
        try:
            if hasattr(msg, 'content') and msg.content:
                return str(msg.content)
            if hasattr(msg, 'text') and msg.text:
                return str(msg.text)
            if hasattr(msg, 'message') and msg.message:
                return str(msg.message)
            if isinstance(msg, str):
                return msg
            return ""
        except Exception:
            return ""

    try:
        @agent.on("user_speech_committed")
        def on_user_speech(msg):
            try:
                text = extract_text(msg)
                if text.strip():
                    asyncio.create_task(save_transcript(room_name_for_transcript, "user", text))
            except Exception:
                pass

        @agent.on("agent_speech_committed")
        def on_agent_speech(msg):
            try:
                text = extract_text(msg)
                if text.strip():
                    asyncio.create_task(save_transcript(room_name_for_transcript, "ai", text))
            except Exception:
                pass

        logger.info("Transcript event listeners registered")
    except Exception as e:
        logger.warning(f"Could not register transcript events (agent will still work): {e}")

    # Wait for participant
    participant = await ctx.wait_for_participant()
    logger.info(f"Participant connected: {participant.identity}")

    # For outbound calls, the SIP participant joins the room BEFORE the phone
    # actually picks up (~5-10 seconds of ringing). We need to wait for actual
    # audio to flow. For inbound, the phone is already connected.
    if not is_inbound:
        # Wait minimal time for SIP media to establish
        logger.info("Outbound call: waiting for media...")
        await asyncio.sleep(0.5)
    else:
        await asyncio.sleep(0.3)

    # Speak the greeting (always set now — same path for all cases)
    logger.info(f"Speaking greeting: {greeting[:60]}")
    await agent.say(greeting, allow_interruptions=True)
    logger.info("Greeting dispatched, agent is now listening")

    # Keep the agent alive — without this the function exits and the agent stops
    # The agent will continue handling conversation until the room closes
    shutdown_event = asyncio.Event()

    @ctx.room.on("disconnected")
    def on_disconnect():
        shutdown_event.set()

    await shutdown_event.wait()
    logger.info("Room disconnected, agent shutting down")


# ──────────────────────────────────────────────
# CLI Entry
# ──────────────────────────────────────────────
if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            num_idle_processes=3,
        ),
    )
