"""
Weather Intake Agent + Risk Scoring Agent.

Honest note (keep this in mind for the demo video):
- OpenWeatherMap gives REAL live rainfall/forecast data for Karachi.
- "historically_flood_prone" is seeded/curated reference data, not live sensor data.
- Risk score = live rainfall intensity x zone's historical flood-proneness.
  This is a simple, explainable model on purpose, good enough to demonstrate
  the agent pattern without pretending to have infrastructure we don't have.
"""
import os
import time
import httpx

OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY", "")
OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/forecast"

_rainfall_cache: dict[str, tuple[float, float]] = {}


async def fetch_rainfall_mm(lat: float, lng: float) -> float:
    cache_key = f"{round(lat, 2)}:{round(lng, 2)}"
    now = time.time()
    if cache_key in _rainfall_cache:
        val, t = _rainfall_cache[cache_key]
        if now - t < 60:
            return val
    """
    Returns expected/live rainfall (mm) for a point.
    Uses OpenWeatherMap if OPENWEATHER_API_KEY is configured.
    Falls back to Open-Meteo keyless free API for real live rainfall data.
    Gracefully returns 0.0 if network is unreachable without crashing.
    """
    if OPENWEATHER_API_KEY:
        params = {
            "lat": lat,
            "lon": lng,
            "appid": OPENWEATHER_API_KEY,
            "units": "metric",
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(OPENWEATHER_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
                first_slot = data.get("list", [{}])[0]
                rain = first_slot.get("rain", {})
                return float(rain.get("3h", 0.0))
        except Exception:
            pass

    # Free keyless fallback: Open-Meteo live precipitation
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=precipitation"
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                current_precip = float(data.get("current", {}).get("precipitation", 0.0))
                _rainfall_cache[cache_key] = (current_precip, now)
                return current_precip
    except Exception:
        pass

    return 0.0


def score_risk(rainfall_mm: float, historically_flood_prone: bool, recent_reports: int) -> dict:
    """
    Simple, explainable risk model:
    - base score from live rainfall intensity
    - multiplier if zone has known flood history
    - bump from recent community reports (waterlogging/blocked road etc.)
    """
    base = min(rainfall_mm / 2.0, 10.0)  # cap contribution at 10
    history_multiplier = 1.5 if historically_flood_prone else 1.0
    report_bump = min(recent_reports * 1.5, 6.0)

    score = round((base * history_multiplier) + report_bump, 1)
    score = min(score, 10.0)

    if score >= 7:
        level = "HIGH"
    elif score >= 4:
        level = "MODERATE"
    elif score > 0:
        level = "LOW"
    else:
        level = "NONE"

    return {
        "score": score,
        "level": level,
        "rainfall_mm": rainfall_mm,
        "recent_reports": recent_reports,
    }
