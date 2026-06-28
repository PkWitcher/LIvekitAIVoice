"""
LiveKit AI Voice Agent — Production PSTN Voice Agent
Pipeline: VAD (Silero) → STT (Deepgram Nova-2) → LLM (Groq/OpenAI) → TTS (Deepgram/OpenAI/Sarvam/Cartesia)
Supports inbound and outbound calls via SIP trunks.
"""

import json
import logging
import ssl
import asyncio
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


def create_tts(provider: str = None, voice_id: str = None):
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
        tts_model = config.TTS_PROVIDERS["cartesia"].get("model", "sonic-multilingual")
        tts_lang = config.TTS_PROVIDERS["cartesia"].get("language", "en")
        try:
            return cartesia.TTS(
                model=tts_model,
                voice=voice,
                language=tts_lang,
                api_key=os.getenv("CARTESIA_API_KEY", ""),
            )
        except TypeError:
            return cartesia.TTS(
                voice=voice,
                api_key=os.getenv("CARTESIA_API_KEY", ""),
            )
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
        try:
            return elevenlabs.TTS(
                voice=voice,
                model=model_id,
                api_key=eleven_key,
            )
        except TypeError:
            # Try alternate constructor signature
            try:
                return elevenlabs.TTS(
                    voice_id=voice,
                    model_id=model_id,
                    api_key=eleven_key,
                )
            except Exception as e:
                logger.error(f"Failed to create ElevenLabs TTS: {e}")
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
    metadata = parse_room_metadata(ctx.room.metadata)
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
        system_prompt = custom_prompt
    else:
        system_prompt = config.SYSTEM_PROMPT

    # Determine if inbound (user already in room) or outbound
    existing_participants = ctx.room.remote_participants
    is_inbound = len(existing_participants) > 0

    if is_inbound:
        logger.info("Inbound call detected — user already in room")
        greeting = config.INBOUND_GREETING
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
        system_prompt += f"\n\nSTRICT RULE: This call's language is set to {target_lang}. Speak ONLY in {target_lang}. Do NOT use any other language."
    else:
        system_prompt += "\n\nSTRICT RULE: Detect the caller's language from their FIRST sentence. Then speak ONLY in that language for the entire call. NEVER switch mid-call."

    # Create pipeline components
    fnc_ctx = CallFunctions() if not custom_prompt else None
    stt = deepgram.STT(
        model=config.STT_MODEL,
        language=stt_language,
    )
    llm_plugin = create_llm_plugin(model_provider)
    tts = create_tts(tts_provider, voice_id)
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

    # Wait for participant
    participant = await ctx.wait_for_participant()
    logger.info(f"Participant connected: {participant.identity}")

    # For outbound calls, the SIP participant joins the room BEFORE the phone
    # actually picks up (~5-10 seconds of ringing). We need to wait for actual
    # audio to flow. For inbound, the phone is already connected.
    if not is_inbound:
        # Wait for the SIP call to be fully established (phone picks up)
        # The phone needs ~6-10 seconds to ring and pick up
        logger.info("Outbound call: waiting for phone to pick up...")
        await asyncio.sleep(6.0)
    else:
        # Inbound: phone is already connected, small delay for media setup
        await asyncio.sleep(1.0)

    # Speak the greeting
    logger.info(f"Saying greeting with TTS provider: {type(tts).__module__}")
    await agent.say(greeting)
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
        ),
    )
