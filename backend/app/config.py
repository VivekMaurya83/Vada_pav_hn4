"""
Application configuration — loads environment variables from .env
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ─── Groq AI ───────────────────────────────────────────────
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", os.getenv("GEMINI_API_KEY", ""))
GROQ_API_URL: str = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL: str = "llama-3.1-8b-instant"  # Faster and more stable model to avoid 503 errors

# ─── Paths ────────────────────────────────────────────────────────
WCAG_DICTIONARY_PATH: str = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "act-mapping-wcag22-final.json",
)

# ─── Playwright ───────────────────────────────────────────────────
PAGE_TIMEOUT_MS: int = 30_000  # 30 seconds
AXE_CDN_URL: str = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js"
