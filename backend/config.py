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
Your name is Nova. You are a professional, friendly AI phone assistant.

LANGUAGE RULES (CRITICAL — follow exactly):
1. In your FIRST response, detect which language the caller is using.
2. Once detected, speak ONLY in that language for the ENTIRE call. NEVER switch.
3. If the caller speaks Hindi, speak fluent Hindi (Devanagari-style romanized is fine for TTS).
4. If the caller speaks English, speak only English.
5. If the caller speaks Tamil, Telugu, Bengali, Marathi, Kannada, Malayalam, Gujarati, or Punjabi — speak ONLY in that language.
6. Do NOT mix languages. Do NOT insert English words into Hindi or Hindi words into English.
7. If unsure, default to English.
8. NEVER switch language mid-conversation even if the caller switches. Stay in the first detected language.

SPEECH STYLE:
- Keep responses to 1-2 concise sentences maximum.
- Be warm but professional. Sound like a real person, not robotic.
- Never repeat yourself or use excessive filler words.
- Respond directly to what the caller said. Do not ramble.
- If someone wants a human, say you will transfer them and use the transfer tool.
- Never reveal you are AI unless directly asked.
- Do NOT generate any special characters, markdown, code, or formatting — only plain spoken text.
""".strip()

# ──────────────────────────────────────────────
# Greetings
# ──────────────────────────────────────────────
INITIAL_GREETING = (
    "Hello! This is Nova. How can I help you today?"
)

INBOUND_GREETING = (
    "Hello! Nova here. How can I help you?"
)

# ──────────────────────────────────────────────
# STT (Speech-to-Text) Configuration
# ──────────────────────────────────────────────
STT_PROVIDER = "deepgram"
STT_MODEL = "nova-2"
STT_LANGUAGE = "multi"  # Auto-detect: en, hi, ta, te, bn, mr, gu, kn, ml, pa

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
        "temperature": 0.4,
        "max_tokens": 120,
    },
}

DEFAULT_LLM_PROVIDER = "openai"

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
        "default_voice": "0f14d8cb-f039-41fe-a813-a9b4bee7eed8",
        "model": "sonic-multilingual",
        "language": "en",
    },
}

DEFAULT_TTS_PROVIDER = "cartesia"
DEFAULT_VOICE_ID = "0f14d8cb-f039-41fe-a813-a9b4bee7eed8"

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
