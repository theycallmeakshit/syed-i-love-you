"""
Karachi Flood Guard — main FastAPI app.

Agent pipeline:
  1. Weather Intake Agent   (weather_agent.fetch_rainfall_mm)
  2. Risk Scoring Agent     (weather_agent.score_risk)
  3. Community Report Agent (this file: /report endpoints)
  4. Advisory Agent         (this file: /zones/{id}/risk combines everything)

Run locally:
  pip install -r requirements.txt
  python seed_data.py
  uvicorn main:app --reload
  open http://127.0.0.1:8000
"""
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from models import get_connection, init_db, ReportIn, ReportOut, ZoneOut, HAZARD_TYPES
from weather_agent import fetch_rainfall_mm, score_risk
from advisory_agent import get_advisory

app = FastAPI(title="Karachi Flood Guard", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/zones", response_model=list[ZoneOut])
def list_zones():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM zones").fetchall()
    conn.close()
    return [
        ZoneOut(
            id=r["id"], name=r["name"], lat=r["lat"], lng=r["lng"],
            historically_flood_prone=bool(r["historically_flood_prone"]),
        )
        for r in rows
    ]


@app.get("/api/reports", response_model=list[ReportOut])
def list_reports(zone_id: str | None = None):
    conn = get_connection()
    if zone_id:
        rows = conn.execute(
            "SELECT * FROM reports WHERE zone_id=? ORDER BY reported_at DESC", (zone_id,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM reports ORDER BY reported_at DESC").fetchall()
    conn.close()
    return [ReportOut(**dict(r)) for r in rows]


@app.post("/api/reports", response_model=ReportOut)
def submit_report(report: ReportIn):
    if report.hazard_type not in HAZARD_TYPES:
        raise HTTPException(400, f"hazard_type must be one of {HAZARD_TYPES}")

    conn = get_connection()
    zone = conn.execute("SELECT id FROM zones WHERE id=?", (report.zone_id,)).fetchone()
    if not zone:
        conn.close()
        raise HTTPException(404, f"Unknown zone_id '{report.zone_id}'")

    reported_at = datetime.utcnow().isoformat()
    cur = conn.execute(
        """INSERT INTO reports (zone_id, hazard_type, description, lat, lng, reported_at, source)
           VALUES (?,?,?,?,?,?,?)""",
        (report.zone_id, report.hazard_type, report.description or "", report.lat, report.lng,
         reported_at, "community"),
    )
    conn.commit()
    new_id = cur.lastrowid
    row = conn.execute("SELECT * FROM reports WHERE id=?", (new_id,)).fetchone()
    conn.close()
    return ReportOut(**dict(row))


@app.get("/api/zones/{zone_id}/risk")
async def zone_risk(zone_id: str):
    conn = get_connection()
    zone = conn.execute("SELECT * FROM zones WHERE id=?", (zone_id,)).fetchone()
    if not zone:
        conn.close()
        raise HTTPException(404, "Unknown zone_id")

    cutoff = (datetime.utcnow() - timedelta(hours=6)).isoformat()
    recent_count = conn.execute(
        "SELECT COUNT(*) AS c FROM reports WHERE zone_id=? AND reported_at >= ?",
        (zone_id, cutoff),
    ).fetchone()["c"]
    conn.close()

    rainfall_mm = await fetch_rainfall_mm(zone["lat"], zone["lng"])
    risk = score_risk(rainfall_mm, bool(zone["historically_flood_prone"]), recent_count)

    return {
        "zone_id": zone_id,
        "zone_name": zone["name"],
        **risk,
    }


@app.get("/api/zones/{zone_id}/advisory")
async def zone_advisory(zone_id: str):
    """
    Advisory Agent, Gemini-backed. Called ONLY on user click from the
    frontend — never from the 30s auto-refresh loop — to stay within
    free-tier quota. Only produces output for MODERATE/HIGH risk.
    """
    risk = await zone_risk(zone_id)
    result = await get_advisory(
        zone_name=risk["zone_name"],
        level=risk["level"],
        score=risk["score"],
        rainfall_mm=risk["rainfall_mm"],
        recent_reports=risk["recent_reports"],
    )
    return {**risk, **result}


@app.get("/api/risk-overview")
async def risk_overview():
    """Advisory Agent: risk score for every zone in one call, for the map view."""
    conn = get_connection()
    zones = conn.execute("SELECT * FROM zones").fetchall()
    conn.close()

    results = []
    for zone in zones:
        result = await zone_risk(zone["id"])
        results.append(result)
    return results


app.mount("/", StaticFiles(directory="static", html=True), name="static")
