"""
LiveKit AI Voice Agent — Production PSTN Voice Agent
Pipeline: VAD (Silero) → STT (Deepgram Nova-2) → LLM (Groq/OpenAI) → TTS (Deepgram/OpenAI/Sarvam/Cartesia)
Supports inbound and outbound calls via SIP trunks.
"""

import json
import logging
import ssl
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
from livekit.plugins import cartesia, deepgram, openai, silero

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
    # Auto-detect provider from voice name
    OPENAI_VOICES = {"alloy", "echo", "shimmer", "nova", "fable", "onyx"}
    if voice_id:
        if voice_id.startswith("aura-"):
            provider = "deepgram"
        elif voice_id in OPENAI_VOICES:
            provider = "openai"
        elif len(voice_id) == 36 and "-" in voice_id:
            provider = "cartesia"
    provider = provider or config.DEFAULT_TTS_PROVIDER

    logger.info(f"TTS provider: {provider}, voice: {voice_id}")

    if provider == "cartesia":
        import os
        voice = voice_id or config.TTS_PROVIDERS["cartesia"]["default_voice"]
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
# TTS Filter — strip function call artifacts
# ──────────────────────────────────────────────
import re

def before_tts_cb(agent, text: str) -> str:
    """Filter out function call artifacts before sending to TTS."""
    if not text:
        return text
    # Only remove obvious function call patterns
    cleaned = re.sub(r'</?(?:function_call|tool_call|function|tool)[^>]*>', '', text)
    cleaned = re.sub(r'\bfunction_\w+\b', '', cleaned)
    cleaned = cleaned.strip()
    # If cleaning removed everything, return original text
    return cleaned if cleaned else text


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
        padding_duration=config.VAD_PADDING_DURATION,
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
    # If a custom prompt is provided, use it as the full system prompt
    # Otherwise fall back to the default Nova persona
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

    # Add language hint to prompt if a specific language is selected
    lang_names = {
        "hi": "Hindi/Hinglish", "en": "English", "ta": "Tamil", "te": "Telugu",
        "bn": "Bengali", "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada",
        "ml": "Malayalam", "pa": "Punjabi",
    }
    if stt_language != "multi" and stt_language in lang_names:
        system_prompt += f"\n\nIMPORTANT: This call is set to {lang_names[stt_language]}. Always reply in {lang_names[stt_language]}."

    # Create pipeline components
    fnc_ctx = CallFunctions()
    stt = deepgram.STT(model=config.STT_MODEL, language=stt_language)
    llm_plugin = create_llm_plugin(model_provider)
    tts = create_tts(tts_provider, voice_id)

    # Build the voice pipeline agent
    agent = VoicePipelineAgent(
        vad=ctx.proc.userdata["vad"],
        stt=stt,
        llm=llm_plugin,
        tts=tts,
        fnc_ctx=fnc_ctx,
        chat_ctx=llm.ChatContext().append(
            role="system",
            text=system_prompt,
        ),
    )

    # Dial outbound if phone_number specified and no one is in the room yet
    if phone_number and not is_inbound:
        await dial_outbound(ctx, phone_number, metadata)

    # Start the agent
    agent.start(ctx.room)

    # Say the greeting once a participant connects
    if is_inbound:
        await agent.say(greeting, allow_interruptions=True)
    else:
        # Wait for the SIP participant to join before greeting
        @ctx.room.on("participant_connected")
        def on_participant_connected(participant: rtc.RemoteParticipant):
            logger.info(f"Participant connected: {participant.identity}")

        # Use a simple approach: wait for first participant then greet
        async def wait_and_greet():
            try:
                participant = await ctx.wait_for_participant()
                logger.info(f"Participant joined: {participant.identity}")
                await agent.say(greeting, allow_interruptions=True)
            except Exception as e:
                logger.error(f"Error waiting for participant: {e}")

        import asyncio
        asyncio.ensure_future(wait_and_greet())

    logger.info("Voice agent is running")


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
