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
You are a helpful, professional, multilingual AI voice receptionist.
Your name is Nova. You work for a company and handle inbound and outbound phone calls.

Guidelines:
- Be VERY concise. Use 1-2 short sentences max. Never ramble.
- Speak in the language the caller uses. You support English, Hindi, and regional Indian languages.
- If the caller asks to speak to a human, offer to transfer them immediately.
- Never reveal you are an AI unless directly asked.
- If you don't know something, say so honestly and offer to connect to a human agent.
- Always be polite, patient, and professional.
- Every extra word costs money. Be brief like a real receptionist on a busy day.
""".strip()

# ──────────────────────────────────────────────
# Greetings
# ──────────────────────────────────────────────
INITIAL_GREETING = (
    "Hello! This is Nova, your AI assistant. "
    "How can I help you today?"
)

INBOUND_GREETING = (
    "Thank you for calling. This is Nova, your AI assistant. "
    "How may I assist you?"
)

# ──────────────────────────────────────────────
# STT (Speech-to-Text) Configuration
# ──────────────────────────────────────────────
STT_PROVIDER = "deepgram"
STT_MODEL = "nova-2"
STT_LANGUAGE = "en"

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
        "voices": {
            "sonic-2": "sonic-2",
        },
        "default_voice": "sonic-2",
        "model": "sonic-2",
    },
}

DEFAULT_TTS_PROVIDER = "deepgram"
DEFAULT_VOICE_ID = "aura-asteria-en"

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
VAD_MIN_SILENCE_DURATION = 0.5
VAD_PADDING_DURATION = 0.3
VAD_THRESHOLD = 0.5

# ──────────────────────────────────────────────
# Agent Identity
# ──────────────────────────────────────────────
AGENT_WORKER_NAME = "outbound-caller"
