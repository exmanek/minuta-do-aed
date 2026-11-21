"""Funkcje zapisu/odczytu. Dla aed_history i declarations wyłącznie dopisywanie.
Zgłoszenia społeczności (field_reports) nie mają ścieżki zapisu do tabeli aed."""
import json

from .db import get_db


def list_aed_rows():
    rows = get_db().execute("SELECT * FROM aed WHERE status = 'zatwierdzony'").fetchall()
    return [_row_to_record(r) for r in rows]


def get_aed_row(aed_id):
    r = get_db().execute("SELECT * FROM aed WHERE aed_id = ? AND status = 'zatwierdzony'", (aed_id,)).fetchone()
    return _row_to_record(r) if r else None


def _row_to_record(r):
    rec = json.loads(r["payload_json"])
    rec["aed_id"] = r["aed_id"]
    rec["lat"], rec["lon"] = r["lat"], r["lon"]
    rec["data_ostatniego_potwierdzenia"] = r["data_ostatniego_potwierdzenia"]
    rec["data_ostatniej_edycji"] = r["data_ostatniej_edycji"]
    return rec
