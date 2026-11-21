"""Wstawia 2 FIKCYJNE rekordy demo do SQLite (dane_przykladowe=true). Uruchom: python scripts/seed_demo.py"""
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.config import Config
from app.storage.db import init_db

init_db(Config.DB_PATH)
DEMO = [
    dict(aed_id="AED-DEMO-0001", lat=52.2286, lon=21.0035, adres="Al. Przykładowa 1", miasto="Warszawa", dostepnosc="calodobowo",
         godziny_dostepu=None, bariera_dostepu="brak", ograniczenia_dostepu="publiczny", stan="sprawny"),
    dict(aed_id="AED-DEMO-0002", lat=52.2330, lon=21.0210, adres="ul. Testowa 5", miasto="Warszawa", dostepnosc="nieznana",
         godziny_dostepu=None, bariera_dostepu="nieznana", ograniczenia_dostepu="nieznane", stan="nieznany"),
]
con = sqlite3.connect(Config.DB_PATH)
for d in DEMO:
    p = dict(d, nazwa_dostawcy="Dostawca Demo 1", regon_dostawcy="123456785", dysponent_nazwa="Dysponent Demo A",
             zrodlo_danych="Zbiór demonstracyjny A", zakres_referencyjny="Dane demonstracyjne (fikcyjne), Warszawa",
             dane_przykladowe=True, oswiadczenie_prawdziwosci=True)
    con.execute("INSERT OR REPLACE INTO aed (aed_id,payload_json,lat,lon,regon_dostawcy,data_ostatniego_potwierdzenia,data_ostatniej_edycji)"
                " VALUES (?,?,?,?,?,?,?)",
                (d["aed_id"], json.dumps(p, ensure_ascii=False), d["lat"], d["lon"], "123456785",
                 "2026-11-15" if d["aed_id"].endswith("1") else None, "2026-11-15"))
con.commit()
print("Dodano rekordy demo:", [d["aed_id"] for d in DEMO])
