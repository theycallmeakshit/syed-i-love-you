"""
Advisory Agent — uses Gemini to turn a raw risk score into a plain-language
warning for citizens.

Design decisions (deliberate, not accidental):
- Only called for MODERATE/HIGH risk zones. LOW/NONE risk doesn't need an
  AI-generated warning — that's wasted quota for zero user value.
- Only triggered on-click (user selects a zone), NOT on the 30s auto-refresh
  poll. Auto-refresh recalculates the numeric risk score (cheap, local
  compute); it never calls Gemini. This is what keeps this within Gemini's
  free-tier per-minute request cap.
- In-memory cache keyed on (zone_id, risk_level). Same zone at the same
  risk level returns the cached advisory instead of a fresh Gemini call.
  Cache invalidates naturally when risk_level changes (e.g. LOW -> HIGH
  after new reports/rain), which is exactly when a new warning is needed.
"""
import os
from google import genai

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

_client = None
_advisory_cache: dict[str, str] = {}


def _get_client():
    global _client
    if _client is None and GEMINI_API_KEY:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


async def get_advisory(zone_name: str, level: str, score: float,
                        rainfall_mm: float, recent_reports: int) -> dict:
    """
    Returns a plain-language advisory for MODERATE/HIGH risk zones only.
    Returns None for LOW/NONE — no advisory needed, no API call made.
    """
    if level not in ("MODERATE", "HIGH"):
        return {"advisory": None, "source": "not_applicable"}

    cache_key = f"{zone_name}:{level}"
    if cache_key in _advisory_cache:
        return {"advisory": _advisory_cache[cache_key], "source": "cached"}

    client = _get_client()
    if client is None:
        # No API key configured -> graceful fallback, not a crash
        fallback = f"{level} flood risk in {zone_name}. Avoid this route if possible."
        return {"advisory": fallback, "source": "fallback_no_key"}

    prompt = (
        f"You are a flood safety advisor for Karachi, Pakistan. "
        f"Zone: {zone_name}. Risk level: {level} ({score}/10). "
        f"Rainfall forecast: {rainfall_mm}mm. Recent hazard reports: {recent_reports}. "
        f"Write ONE short, plain-language warning (max 25 words) a commuter would "
        f"understand instantly. Be direct and practical. No preamble, just the warning."
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        advisory_text = response.text.strip()
        _advisory_cache[cache_key] = advisory_text
        return {"advisory": advisory_text, "source": "gemini"}
    except Exception:
        # Quota hit, network issue, etc. -> degrade gracefully
        fallback = f"{level} flood risk in {zone_name}. Avoid this route if possible."
        return {"advisory": fallback, "source": "fallback_error"}
