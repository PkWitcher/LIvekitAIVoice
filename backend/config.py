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
    "Hello! How can I help you today?"
)

INBOUND_GREETING = (
    "Hello! How can I help you?"
)

# ──────────────────────────────────────────────
# STT (Speech-to-Text) Configuration
# ──────────────────────────────────────────────
STT_PROVIDER = "sarvam"
STT_MODEL = "saarika:v2"  # Sarvam Saarika STT
STT_LANGUAGE = "unknown"  # Auto-detect: en, hi, ta, te, bn, mr, gu, kn, ml, pa

# ──────────────────────────────────────────────
# LLM Configuration
# ──────────────────────────────────────────────
LLM_PROVIDERS = {
    "groq": {
        "model": "llama-3.3-70b-versatile",
        "api_key_env": "GROQ_API_KEY",
        "base_url": "https://api.groq.com/openai/v1",
        "temperature": 0.6,
        "max_tokens": 80,
    },
    "openai": {
        "model": "gpt-4o-mini",
        "api_key_env": "OPENAI_API_KEY",
        "base_url": "https://api.openai.com/v1",
        "temperature": 0.4,
        "max_tokens": 80,
    },
}

DEFAULT_LLM_PROVIDER = "groq"

# ──────────────────────────────────────────────
# TTS (Text-to-Speech) Configuration
# ──────────────────────────────────────────────
TTS_PROVIDERS = {
    "sarvam": {
        "voices": {
            # Sarvam Bulbul v3 voices (official list)
            # Female voices
            "ritu": "ritu",
            "priya": "priya",
            "neha": "neha",
            "pooja": "pooja",
            "simran": "simran",
            "kavya": "kavya",
            "ishita": "ishita",
            "shreya": "shreya",
            "roopa": "roopa",
            "tanya": "tanya",
            "shruti": "shruti",
            "suhani": "suhani",
            "kavitha": "kavitha",
            "rupali": "rupali",
            "niharika": "niharika",
            # Male voices
            "aditya": "aditya",
            "ashutosh": "ashutosh",
            "rahul": "rahul",
            "rohan": "rohan",
            "amit": "amit",
            "dev": "dev",
            "ratan": "ratan",
            "varun": "varun",
            "manan": "manan",
            "sumit": "sumit",
            "kabir": "kabir",
            "aayan": "aayan",
            "shubh": "shubh",
            "advait": "advait",
            "anand": "anand",
            "tarun": "tarun",
            "sunny": "sunny",
            "mani": "mani",
            "gokul": "gokul",
            "vijay": "vijay",
            "mohit": "mohit",
            "rehan": "rehan",
            "soham": "soham",
        },
        "default_voice": "priya",
        "model": "bulbul:v3",
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
}

DEFAULT_TTS_PROVIDER = "sarvam"
DEFAULT_VOICE_ID = "priya"

# Sarvam language code mapping (BCP-47 codes required by Sarvam API)
SARVAM_LANGUAGE_CODES = {
    "en": "en-IN",
    "hi": "hi-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "bn": "bn-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "pa": "pa-IN",
    "od": "od-IN",
    "multi": "hi-IN",   # default for auto-detect
    "unknown": "hi-IN", # default for unknown
}

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
VAD_MIN_SILENCE_DURATION = 0.35   # wait longer before assuming caller stopped
VAD_PADDING_DURATION = 0.25       # more padding for phone audio
VAD_THRESHOLD = 0.45              # balanced sensitivity for SIP calls

# ──────────────────────────────────────────────
# Agent Identity
# ──────────────────────────────────────────────
AGENT_WORKER_NAME = "outbound-caller"
