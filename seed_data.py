"""
Delhi Hazard Watch : Seed Data.
Seeds SQLite database with verified Delhi waterlogging blackspots, low-lying
flood zones, and realistic sample community hazard reports.
"""
from datetime import datetime, timedelta, timezone
from models import get_connection, init_db

ZONES = [
    ("minto_bridge", "Minto Bridge Underpass", 28.6328, 77.2245, 1),
    ("ito", "ITO Vikas Marg Junction", 28.6297, 77.2425, 1),
    ("pul_prahladpur", "Pul Prahladpur Underpass", 28.5028, 77.2917, 1),
    ("zakhira", "Zakhira Underpass (Rohtak Rd)", 28.6657, 77.1610, 1),
    ("kashmere_gate", "Kashmere Gate ISBT Underpass", 28.6675, 77.2285, 1),
    ("azadpur", "Azadpur Underpass (Ring Rd)", 28.7077, 77.1758, 1),
    ("dhaula_kuan", "Dhaula Kuan Subway", 28.5921, 77.1614, 1),
    ("mukarba_chowk", "Mukarba Chowk (GT Karnal Rd)", 28.7368, 77.1524, 1),
    ("burari", "Burari Lowlands (Yamuna Pushta)", 28.7540, 77.2025, 1),
    ("yamuna_bazaar", "Yamuna Bazaar (Old Bridge Ghat)", 28.6582, 77.2384, 1),
    ("mb_road", "Mehrauli-Badarpur Road", 28.5142, 77.2452, 1),
    ("pragati_maidan", "Pragati Maidan Tunnel", 28.6186, 77.2411, 0),
]

SAMPLE_REPORTS = [
    ("minto_bridge", "waterlogging", "Water accumulation approx 1.5 ft under railway bridge. Vehicles diverted.", 28.6328, 77.2245, -30),
    ("pul_prahladpur", "road_blocked", "Underpass closed to traffic due to inundation.", 28.5028, 77.2917, -85),
    ("zakhira", "open_manhole", "Uncovered utility pit on south carriageway.", 28.6657, 77.1610, -140),
    ("ito", "waterlogging", "Slow vehicular movement due to waterlogged curb lanes on Vikas Marg.", 28.6297, 77.2425, -60),
    ("kashmere_gate", "power_outage", "Traffic signal outage near GPO crossing.", 28.6675, 77.2285, -190),
    ("mb_road", "broken_road", "Multiple deep asphalt potholes near Khanpur junction.", 28.5142, 77.2452, -250),
]


def seed():
    init_db()
    conn = get_connection()

    # Clear old zones and seed Delhi zones
    conn.execute("DELETE FROM zones")
    for zone_id, name, lat, lng, flood_prone in ZONES:
        conn.execute(
            "INSERT OR REPLACE INTO zones (id, name, lat, lng, historically_flood_prone) VALUES (?,?,?,?,?)",
            (zone_id, name, lat, lng, flood_prone),
        )

    # Clean existing reports and seed Delhi samples
    conn.execute("DELETE FROM reports")
    for zone_id, hazard_type, desc, lat, lng, minutes_ago in SAMPLE_REPORTS:
        reported_at = (datetime.now(timezone.utc) - timedelta(minutes=abs(minutes_ago))).isoformat()
        conn.execute(
            """INSERT INTO reports (zone_id, hazard_type, description, lat, lng, reported_at, source)
               VALUES (?,?,?,?,?,?,?)""",
            (zone_id, hazard_type, desc, lat, lng, reported_at, "seeded"),
        )

    conn.commit()
    conn.close()
    print("Seed complete: 12 Delhi zones + verified hazard reports inserted.")


if __name__ == "__main__":
    seed()
