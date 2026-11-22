"""Wstawia FIKCYJNE rekordy demo do SQLite (dane_przykladowe=true). Uruchom: python scripts/seed_demo.py"""
import json
import sqlite3
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.config import Config
from app.storage.db import init_db

TODAY = date.today()
d = lambda days: (TODAY - timedelta(days=days)).isoformat()

# (lat, lon, adres, miasto, lokalizacja, dostepnosc, godziny, bariera, ograniczenia, stan, potwierdzenie)
ROWS = [
    (52.2286, 21.0035, "Al. Przykładowa 1", "Warszawa", "Hol główny, przy recepcji", "calodobowo", None, "brak", "publiczny", "sprawny", d(10)),
    (52.2330, 21.0210, "ul. Testowa 5", "Warszawa", "Korytarz, I piętro", "nieznana", None, "nieznana", "nieznane", "nieznany", None),
    (52.2297, 21.0122, "ul. Demo 3", "Warszawa", "Przy wejściu do biblioteki", "w_godzinach", "Mo-Fr 08:00-18:00", "brak", "publiczny", "sprawny", d(40)),
    (52.2250, 21.0100, "ul. Demo 7", "Warszawa", "Szafka na zewnątrz budynku", "calodobowo", None, "kod", "publiczny", "sprawny", d(100)),
    (52.2400, 21.0300, "ul. Demo 9", "Warszawa", "Portiernia", "w_godzinach", "Mo-Su 06:00-22:00", "obsluga", "klienci", "gotowy_do_uzycia", d(200)),
    (52.2200, 21.0000, "ul. Demo 11", "Warszawa", "Zaplecze sklepu", "calodobowo", None, "klucz", "personel", "sprawny", d(300)),
    (52.2350, 21.0150, "ul. Demo 13", "Warszawa", "Hol, parter", "calodobowo", None, "brak", "publiczny", "czasowo_niedostepny", d(20)),
    (52.2310, 21.0050, "ul. Demo 15", "Warszawa", "Dworzec, kasa", "calodobowo", None, "brak", "publiczny", "sprawny", d(400)),
    (52.2270, 21.0180, "ul. Demo 17", "Warszawa", "Szkoła, sekretariat", "w_godzinach", "Mo-Fr 07:00-16:00", "karta", "strefa_zastrzezona", "sprawny", d(500)),
    (52.2380, 21.0080, "ul. Demo 19", "Warszawa", "Urząd, parter", "w_godzinach", "Mo-Fr 08:00-16:00", "brak", "publiczny", "sprawny", None),
    (50.0614, 19.9372, "ul. Wzorcowa 10", "Kraków", "Przy wejściu głównym", "calodobowo", None, "brak", "publiczny", "sprawny", d(5)),
    (50.0647, 19.9450, "ul. Wzorcowa 22", "Kraków", "Recepcja hotelu", "calodobowo", None, "obsluga", "klienci", "sprawny", d(60)),
    (54.3520, 18.6466, "ul. Demo 1", "Gdańsk", "Hol dworca", "calodobowo", None, "brak", "publiczny", "gotowy_do_uzycia", d(15)),
    (51.1079, 17.0385, "ul. Demo 2", "Wrocław", "Centrum handlowe, informacja", "w_godzinach", "Mo-Su 09:00-21:00", "brak", "klienci", "sprawny", d(90)),
    (52.4064, 16.9252, "ul. Demo 4", "Poznań", "Basen, recepcja", "nieznana", None, "nieznana", "nieznane", "nieznany", d(700)),
]

init_db(Config.DB_PATH)
con = sqlite3.connect(Config.DB_PATH)
ids = []
for i, r in enumerate(ROWS, 1):
    aed_id = f"AED-DEMO-{i:04d}"
    lat, lon, adres, miasto, lok, dost, godz, bar, ogr, stan, pot = r
    p = dict(adres=adres, miasto=miasto, lokalizacja_w_obiekcie=lok, dostepnosc=dost, godziny_dostepu=godz,
             bariera_dostepu=bar, ograniczenia_dostepu=ogr, stan=stan, nazwa_dostawcy="Dostawca Demo 1",
             regon_dostawcy="123456785", dysponent_nazwa="Dysponent Demo A", zrodlo_danych="Zbiór demonstracyjny A",
             zakres_referencyjny="Dane demonstracyjne (fikcyjne)", dane_przykladowe=True, oswiadczenie_prawdziwosci=True)
    con.execute("INSERT OR REPLACE INTO aed (aed_id,payload_json,lat,lon,regon_dostawcy,data_ostatniego_potwierdzenia,"
                "data_ostatniej_edycji) VALUES (?,?,?,?,?,?,?)",
                (aed_id, json.dumps(p, ensure_ascii=False), lat, lon, "123456785", pot, d(1)))
    ids.append(aed_id)
con.commit()
print(f"Dodano {len(ids)} rekordów demo: {ids[0]} … {ids[-1]}")
