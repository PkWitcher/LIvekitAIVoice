"""
LiveKit AI Voice Agent — Production PSTN Voice Agent
Pipeline: VAD (Silero) → STT (Sarvam Saarika) → LLM (Groq/OpenAI) → TTS (Sarvam Bulbul)
Supports inbound and outbound calls via SIP trunks.
"""

import json
import logging
import re
import ssl
import asyncio
import urllib.request
import os
import base64
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
    stt as stt_module,
    tts as tts_module,
)
from livekit.agents.pipeline import VoicePipelineAgent
from livekit.plugins import openai, silero

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
# Sarvam AI HTTP helpers
# ──────────────────────────────────────────────
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_BASE_URL = "https://api.sarvam.ai"


async def sarvam_stt_request(audio_bytes: bytes, language: str = "unknown") -> str:
    """Call Sarvam Saarika STT API and return transcript text."""
    import io
    url = f"{SARVAM_BASE_URL}/speech-to-text"
    lang_code = config.SARVAM_LANGUAGE_CODES.get(language, "hi-IN")

    # Build multipart form data
    boundary = "----SarvamBoundary"
    body = io.BytesIO()
    # Audio file part
    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n')
    body.write(b"Content-Type: audio/wav\r\n\r\n")
    body.write(audio_bytes)
    body.write(b"\r\n")
    # Language code part
    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="language_code"\r\n\r\n')
    body.write(lang_code.encode())
    body.write(b"\r\n")
    # Model part
    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="model"\r\n\r\n')
    body.write(config.STT_MODEL.encode())
    body.write(b"\r\n")
    body.write(f"--{boundary}--\r\n".encode())

    content_type = f"multipart/form-data; boundary={boundary}"
    data = body.getvalue()

    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Content-Type": content_type,
            "api-subscription-key": SARVAM_API_KEY,
        },
    )
    response = await asyncio.get_event_loop().run_in_executor(
        None, lambda: urllib.request.urlopen(req, context=ssl_ctx)
    )
    result = json.loads(response.read().decode())
    return result.get("transcript", "")


async def sarvam_tts_request(text: str, speaker: str = "anushka", language: str = "hi-IN") -> bytes:
    """Call Sarvam Bulbul TTS API and return raw audio bytes."""
    url = f"{SARVAM_BASE_URL}/text-to-speech"
    model = config.TTS_PROVIDERS["sarvam"].get("model", "bulbul:v3")

    # Skip empty/whitespace-only text
    if not text or not text.strip():
        logger.warning("Sarvam TTS: skipping empty text")
        return b""

    payload = json.dumps({
        "text": text.strip(),
        "language_code": language,
        "speaker": speaker,
        "model": model,
    }).encode("utf-8")

    logger.info(f"Sarvam TTS request: text='{text.strip()[:50]}', speaker={speaker}, lang={language}, model={model}")

    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "api-subscription-key": SARVAM_API_KEY,
        },
    )
    try:
        response = await asyncio.get_event_loop().run_in_executor(
            None, lambda: urllib.request.urlopen(req, context=ssl_ctx)
        )
        result = json.loads(response.read().decode())
        audio_b64 = "".join(result.get("audios", []))
        return base64.b64decode(audio_b64)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else "no body"
        logger.error(f"Sarvam TTS HTTP {e.code}: {error_body}")
        raise


# ──────────────────────────────────────────────
# Sarvam TTS adapter for LiveKit pipeline
# ──────────────────────────────────────────────
class SarvamTTS(tts_module.TTS):
    """Sarvam Bulbul TTS adapter for LiveKit VoicePipelineAgent."""

    def __init__(self, voice: str = "anushka", language: str = "hi-IN"):
        super().__init__(
            capabilities=tts_module.TTSCapabilities(streaming=False),
            sample_rate=24000,
            num_channels=1,
        )
        self._voice = voice
        self._language = language

    def update_language(self, language: str):
        """Update the language code for TTS."""
        self._language = config.SARVAM_LANGUAGE_CODES.get(language, language)

    def synthesize(self, text: str) -> "SarvamTTSStream":
        return SarvamTTSStream(self, text)


class SarvamTTSStream(tts_module.ChunkedStream):
    """Stream adapter that calls Sarvam TTS API."""

    def __init__(self, tts: SarvamTTS, text: str):
        super().__init__(tts=tts, input_text=text)
        self._tts = tts
        self._text = text

    async def _run(self):
        try:
            # Skip empty text (LiveKit may send empty tokens)
            if not self._text or not self._text.strip():
                return

            audio_bytes = await sarvam_tts_request(
                self._text,
                speaker=self._tts._voice,
                language=self._tts._language,
            )
            if not audio_bytes:
                return

            # Send audio as a single frame
            import numpy as np
            samples = np.frombuffer(audio_bytes, dtype=np.int16)
            frame = rtc.AudioFrame(
                data=samples.tobytes(),
                sample_rate=24000,
                num_channels=1,
                samples_per_channel=len(samples),
            )
            self._event_ch.send_nowait(
                tts_module.SynthesizedAudio(
                    request_id="",
                    frame=frame,
                )
            )
        except Exception as e:
            logger.error(f"Sarvam TTS error: {e}")
            raise


# ──────────────────────────────────────────────
# Sarvam STT adapter for LiveKit pipeline
# ──────────────────────────────────────────────
class SarvamSTT(stt_module.STT):
    """Sarvam Saarika STT adapter for LiveKit VoicePipelineAgent."""

    def __init__(self, language: str = "unknown"):
        super().__init__(
            capabilities=stt_module.STTCapabilities(
                streaming=False,
                interim_results=False,
            ),
        )
        self._language = language

    async def _recognize_impl(self, buffer: rtc.AudioFrame, *, language: str | None = None) -> stt_module.SpeechEvent:
        """Recognize speech from an audio buffer using Sarvam API."""
        import struct
        import io

        lang = language or self._language

        # Convert AudioFrame to WAV bytes
        audio_data = buffer.data
        sample_rate = buffer.sample_rate
        num_channels = buffer.num_channels
        num_samples = len(audio_data) // 2  # 16-bit PCM

        wav_buffer = io.BytesIO()
        # Write WAV header
        wav_buffer.write(b"RIFF")
        data_size = num_samples * 2
        wav_buffer.write(struct.pack("<I", 36 + data_size))
        wav_buffer.write(b"WAVE")
        wav_buffer.write(b"fmt ")
        wav_buffer.write(struct.pack("<I", 16))  # chunk size
        wav_buffer.write(struct.pack("<H", 1))   # PCM format
        wav_buffer.write(struct.pack("<H", num_channels))
        wav_buffer.write(struct.pack("<I", sample_rate))
        wav_buffer.write(struct.pack("<I", sample_rate * num_channels * 2))
        wav_buffer.write(struct.pack("<H", num_channels * 2))
        wav_buffer.write(struct.pack("<H", 16))  # bits per sample
        wav_buffer.write(b"data")
        wav_buffer.write(struct.pack("<I", data_size))
        wav_buffer.write(audio_data)
        wav_bytes = wav_buffer.getvalue()

        transcript = await sarvam_stt_request(wav_bytes, lang)

        return stt_module.SpeechEvent(
            type=stt_module.SpeechEventType.FINAL_TRANSCRIPT,
            alternatives=[
                stt_module.SpeechData(
                    text=transcript,
                    language=lang,
                ),
            ],
        )


# ──────────────────────────────────────────────
# Provider Factories
# ──────────────────────────────────────────────
def create_stt(language: str = None):
    """Create Sarvam STT instance."""
    lang = language or config.STT_LANGUAGE
    if not SARVAM_API_KEY:
        logger.error("SARVAM_API_KEY not set — STT will fail")
    return SarvamSTT(language=lang)


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
    OPENAI_VOICES = {"alloy", "echo", "shimmer", "nova", "fable", "onyx"}
    SARVAM_VOICES = set(config.TTS_PROVIDERS.get("sarvam", {}).get("voices", {}).values())

    # Auto-detect provider from voice name
    if voice_id:
        if voice_id in OPENAI_VOICES:
            provider = "openai"
        elif voice_id in SARVAM_VOICES:
            provider = "sarvam"

    provider = provider or config.DEFAULT_TTS_PROVIDER
    logger.info(f"TTS provider: {provider}, voice: {voice_id}, language: {language}")

    if provider == "sarvam":
        voice = voice_id or config.TTS_PROVIDERS["sarvam"]["default_voice"]
        lang_code = config.SARVAM_LANGUAGE_CODES.get(language or "hi", "hi-IN")
        if not SARVAM_API_KEY:
            logger.error("SARVAM_API_KEY not set — TTS will fail")
        return SarvamTTS(voice=voice, language=lang_code)
    elif provider == "openai":
        voice = voice_id or config.TTS_PROVIDERS["openai"]["default_voice"]
        return openai.TTS(
            model=config.TTS_PROVIDERS["openai"].get("model", "tts-1"),
            voice=voice,
        )
    else:
        # Default to Sarvam
        voice = voice_id or config.TTS_PROVIDERS["sarvam"]["default_voice"]
        lang_code = config.SARVAM_LANGUAGE_CODES.get(language or "hi", "hi-IN")
        return SarvamTTS(voice=voice, language=lang_code)


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

    # Determine if this is an outbound call or a true inbound call.
    # KEY: If room metadata has phone_number, it's ALWAYS outbound — even if
    # the participant is already in the room (which happens on agent reconnect/restart).
    existing_participants = ctx.room.remote_participants
    participant_already_here = len(existing_participants) > 0

    if phone_number:
        # Outbound call — metadata explicitly says dial this number
        is_outbound = True
        if participant_already_here:
            logger.info("Outbound call RECONNECT — participant already in room (agent restarted mid-call)")
        else:
            logger.info("Outbound call — will dial phone number")
    else:
        # No phone_number in metadata = true inbound call
        is_outbound = False
        logger.info("Inbound call detected — user already in room")

    # Determine greeting
    if not is_outbound:
        greeting = config.INBOUND_GREETING
    elif custom_prompt:
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
    stt = create_stt(stt_language)
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
        allow_interruptions=True,
    )

    # Dial outbound ONLY if it's an outbound call AND participant isn't already here
    if is_outbound and not participant_already_here:
        logger.info(f"Dialing outbound to {phone_number}")
        await dial_outbound(ctx, phone_number, metadata)

    # ── Live Transcript: poll chat context for new messages ──
    # NOTE: Do NOT use agent.on() — it can replace internal handlers and break the pipeline
    room_name_for_transcript = ctx.room.name
    last_msg_count = 0

    async def poll_transcript():
        nonlocal last_msg_count
        while not shutdown_event.is_set():
            try:
                msgs = agent.chat_ctx.messages if hasattr(agent, 'chat_ctx') else []
                current_count = len(msgs)
                if current_count > last_msg_count:
                    for msg in msgs[last_msg_count:]:
                        role = msg.role if hasattr(msg, 'role') else ''
                        content = msg.content if hasattr(msg, 'content') else ''
                        if role == 'assistant' and content and content.strip():
                            await save_transcript(room_name_for_transcript, "ai", content.strip())
                        elif role == 'user' and content and content.strip():
                            await save_transcript(room_name_for_transcript, "user", content.strip())
                    last_msg_count = current_count
            except Exception:
                pass
            await asyncio.sleep(1.5)

    # Wait for participant FIRST — then start agent with that participant
    participant = await ctx.wait_for_participant()
    logger.info(f"Participant connected: {participant.identity}")

    # Start the agent IMMEDIATELY so it registers its internal track listeners.
    # The agent MUST be running when the audio track gets subscribed (via AutoSubscribe)
    # otherwise it misses the subscription event and never receives audio.
    agent.start(ctx.room, participant=participant)
    logger.info(f"Agent pipeline started, listening to {participant.identity}")

    # Wait for audio track to actually be subscribed before speaking greeting.
    # The agent is already running and will capture the track when it arrives.
    # We just delay the greeting so the user's mic is ready when AI finishes speaking.
    async def wait_for_track_ready(p, timeout: float = 10.0) -> bool:
        """Poll until participant has a subscribed audio track."""
        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            for pub in p.track_publications.values():
                if pub.kind == rtc.TrackKind.KIND_AUDIO:
                    if pub.track is not None:
                        logger.info(f"Audio track ready: {pub.sid}")
                        return True
            await asyncio.sleep(0.3)
        return False

    track_ok = await wait_for_track_ready(participant)
    if not track_ok:
        logger.warning("Audio track not detected after 10s — greeting anyway")

    # Small stabilization buffer after track subscription
    await asyncio.sleep(0.3)

    # NOW speak the greeting — audio pipeline is fully ready
    logger.info(f"Speaking greeting: {greeting[:60]}")
    await agent.say(greeting, allow_interruptions=True)
    logger.info("Greeting dispatched, agent is now listening")

    # Keep the agent alive — without this the function exits and the agent stops
    shutdown_event = asyncio.Event()

    # Start transcript polling (runs in background, doesn't touch agent internals)
    asyncio.create_task(poll_transcript())
    logger.info("Transcript polling started")

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
            num_idle_processes=1,
        ),
    )
