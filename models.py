"""
Database models and setup for Karachi Flood Guard.
Uses SQLite for local-only storage — no external DB needed for the demo.
"""
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).parent / "flood_guard.db"

HAZARD_TYPES = [
    "waterlogging",
    "broken_road",
    "open_manhole",
    "power_outage",
    "road_blocked",
]


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS zones (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            historically_flood_prone INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            zone_id TEXT NOT NULL,
            hazard_type TEXT NOT NULL,
            description TEXT,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            reported_at TEXT NOT NULL,
            source TEXT DEFAULT 'community',
            FOREIGN KEY (zone_id) REFERENCES zones (id)
        )
    """)
    conn.commit()
    conn.close()


class ZoneOut(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    historically_flood_prone: bool


class ReportIn(BaseModel):
    zone_id: str
    hazard_type: str = Field(..., description="One of: " + ", ".join(HAZARD_TYPES))
    description: Optional[str] = ""
    lat: float
    lng: float


class ReportOut(BaseModel):
    id: int
    zone_id: str
    hazard_type: str
    description: str
    lat: float
    lng: float
    reported_at: str
    source: str
