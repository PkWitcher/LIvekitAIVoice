"""
Voice Agent Configuration
All prompts, model settings, provider configs, and SIP settings.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ──────────────────────────────────────────────
# System Prompt — Agent Persona
# ──────────────────────────────────────────────
SYSTEM_PROMPT = """
Your name is Nova. You are a friendly AI phone receptionist.

LANGUAGE RULE (most important):
- ALWAYS reply in the SAME language the caller is speaking.
- If they speak Hindi/Hinglish, reply in natural Hinglish (Roman script, not Devanagari). Use fillers like "haan", "ji", "achha", "bilkul".
- If they speak English, reply in natural English.
- If they speak Tamil, Telugu, Bengali, Marathi, or any other language, reply in that language.
- Never mix languages unless the caller does.

STYLE:
- Be warm, friendly, and conversational — like a real person, not a robot.
- Keep replies to 1-2 short sentences. Every extra word costs money.
- Use natural speech patterns, contractions, and casual tone.
- If someone wants a human, offer to transfer immediately.
- Never reveal you are AI unless directly asked.
""".strip()

# ──────────────────────────────────────────────
# Greetings
# ──────────────────────────────────────────────
INITIAL_GREETING = (
    "Hello! Main Nova bol rahi hoon. How can I help you?"
)

INBOUND_GREETING = (
    "Namaste! Nova here. Bataiye, how can I help?"
)

# ──────────────────────────────────────────────
# STT (Speech-to-Text) Configuration
# ──────────────────────────────────────────────
STT_PROVIDER = "deepgram"
STT_MODEL = "nova-2"
STT_LANGUAGE = "multi"  # auto-detect: en, hi, ta, te, bn, mr, etc.

# ──────────────────────────────────────────────
# LLM Configuration
# ──────────────────────────────────────────────
LLM_PROVIDERS = {
    "groq": {
        "model": "llama-3.3-70b-versatile",
        "api_key_env": "GROQ_API_KEY",
        "base_url": "https://api.groq.com/openai/v1",
        "temperature": 0.6,
        "max_tokens": 150,
    },
    "openai": {
        "model": "gpt-4o-mini",
        "api_key_env": "OPENAI_API_KEY",
        "base_url": "https://api.openai.com/v1",
        "temperature": 0.6,
        "max_tokens": 150,
    },
}

DEFAULT_LLM_PROVIDER = "groq"

# ──────────────────────────────────────────────
# TTS (Text-to-Speech) Configuration
# ──────────────────────────────────────────────
TTS_PROVIDERS = {
    "deepgram": {
        "voices": {
            "aura-asteria": "aura-asteria-en",
            "aura-luna": "aura-luna-en",
            "aura-stella": "aura-stella-en",
            "aura-athena": "aura-athena-en",
            "aura-hera": "aura-hera-en",
            "aura-orion": "aura-orion-en",
            "aura-arcas": "aura-arcas-en",
            "aura-perseus": "aura-perseus-en",
        },
        "default_voice": "aura-asteria-en",
    },
    "openai": {
        "voices": {
            "alloy": "alloy",
            "echo": "echo",
            "shimmer": "shimmer",
            "nova": "nova",
            "fable": "fable",
            "onyx": "onyx",
        },
        "default_voice": "alloy",
        "model": "tts-1",
    },
    "sarvam": {
        "voices": {
            "anushka": "anushka",
            "aravind": "aravind",
        },
        "default_voice": "anushka",
    },
    "cartesia": {
        "voices": {},
        "default_voice": "4877b818-c7fe-4c89-b1cf-eadf8e23da72",
        "model": "sonic-multilingual",
    },
}

DEFAULT_TTS_PROVIDER = "cartesia"
DEFAULT_VOICE_ID = "4877b818-c7fe-4c89-b1cf-eadf8e23da72"

# ──────────────────────────────────────────────
# SIP / Telephony Configuration
# ──────────────────────────────────────────────
SIP_TRUNK_ID = os.getenv("VOBIZ_SIP_TRUNK_ID", "")
if not SIP_TRUNK_ID:
    try:
        with open("/tmp/sip_trunk_id", "r") as f:
            SIP_TRUNK_ID = f.read().strip()
    except FileNotFoundError:
        pass
SIP_DOMAIN = os.getenv("VOBIZ_SIP_DOMAIN", "sip.vobiz.com")
SIP_USERNAME = os.getenv("VOBIZ_USERNAME", "")
SIP_PASSWORD = os.getenv("VOBIZ_PASSWORD", "")
SIP_OUTBOUND_NUMBER = os.getenv("VOBIZ_OUTBOUND_NUMBER", "")
DEFAULT_TRANSFER_NUMBER = os.getenv("DEFAULT_TRANSFER_NUMBER", "+919876543210")

# ──────────────────────────────────────────────
# LiveKit Configuration
# ──────────────────────────────────────────────
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "ws://localhost:7880")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")

# ──────────────────────────────────────────────
# VAD (Voice Activity Detection) Configuration
# ──────────────────────────────────────────────
VAD_MIN_SILENCE_DURATION = 0.3    # was 0.5 — respond faster after caller stops
VAD_PADDING_DURATION = 0.2        # was 0.3 — less padding
VAD_THRESHOLD = 0.45              # was 0.5 — slightly more sensitive

# ──────────────────────────────────────────────
# Agent Identity
# ──────────────────────────────────────────────
AGENT_WORKER_NAME = "outbound-caller"
