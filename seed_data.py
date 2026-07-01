"""
Seeds the database with known Karachi flood-prone zones (public knowledge —
underpasses and low-lying areas that flood every monsoon season) and a
handful of sample community reports so the map isn't empty for the demo.
"""
from datetime import datetime, timedelta
from models import get_connection, init_db

ZONES = [
    ("saddar", "Saddar (M.A. Jinnah Rd area)", 24.8546, 67.0207, 1),
    ("korangi", "Korangi Crossing", 24.8260, 67.1280, 1),
    ("north_karachi", "North Karachi Underpass", 24.9456, 67.0822, 1),
    ("liaquatabad", "Liaquatabad Underpass", 24.9034, 67.0359, 1),
    ("clifton", "Clifton Underpass", 24.8138, 67.0299, 0),
    ("gulshan", "Gulshan-e-Iqbal Main Chowrangi", 24.9180, 67.0970, 0),
]

SAMPLE_REPORTS = [
    ("saddar", "waterlogging", "Knee-deep water near Regal Chowk, avoid.", 24.8546, 67.0207, -45),
    ("korangi", "road_blocked", "Crossing flooded, traffic diverted.", 24.8260, 67.1280, -120),
    ("north_karachi", "open_manhole", "Open manhole cover near the underpass entrance, be careful.", 24.9456, 67.0822, -200),
    ("liaquatabad", "power_outage", "No electricity in the area since this afternoon.", 24.9034, 67.0359, -90),
    ("clifton", "broken_road", "Large pothole forming after yesterday's rain.", 24.8138, 67.0299, -300),
]


def seed():
    init_db()
    conn = get_connection()

    for zone_id, name, lat, lng, flood_prone in ZONES:
        conn.execute(
            "INSERT OR IGNORE INTO zones (id, name, lat, lng, historically_flood_prone) VALUES (?,?,?,?,?)",
            (zone_id, name, lat, lng, flood_prone),
        )

    existing = conn.execute("SELECT COUNT(*) AS c FROM reports").fetchone()["c"]
    if existing == 0:
        for zone_id, hazard_type, desc, lat, lng, minutes_ago in SAMPLE_REPORTS:
            reported_at = (datetime.utcnow() - timedelta(minutes=abs(minutes_ago))).isoformat()
            conn.execute(
                """INSERT INTO reports (zone_id, hazard_type, description, lat, lng, reported_at, source)
                   VALUES (?,?,?,?,?,?,?)""",
                (zone_id, hazard_type, desc, lat, lng, reported_at, "seeded"),
            )

    conn.commit()
    conn.close()
    print("Seed complete: zones + sample reports inserted.")


if __name__ == "__main__":
    seed()
