"""Generuje 5 FIKCYJNYCH plików demo w data/sample_sources/ (przypadki graniczne)."""
import csv
import json
from pathlib import Path

from openpyxl import Workbook

OUT = Path(__file__).resolve().parent.parent / "data" / "sample_sources"
OUT.mkdir(parents=True, exist_ok=True)

# 1. CSV zgodny ze wzorcem (utf-8, ;)
std = ["aed_id", "lat", "lon", "adres", "miasto", "lokalizacja_w_obiekcie", "dostepnosc", "godziny_dostepu",
       "bariera_dostepu", "ograniczenia_dostepu", "stan", "data_ostatniego_potwierdzenia"]
with open(OUT / "demo_a_wzorzec.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f, delimiter=";"); w.writerow(std)
    w.writerow(["", 52.2286, 21.0035, "Al. Przykładowa 1", "Warszawa", "Hol główny", "calodobowo", "", "brak", "publiczny", "sprawny", "2026-11-15"])
    w.writerow(["", 52.2330, 21.0210, "ul. Testowa 5", "Warszawa", "I piętro", "w_godzinach", "Mo-Fr 08:00-18:00", "klucz", "personel", "sprawny", ""])

# 2. CSV w cp1250 z obcymi nagłówkami (mapowanie po synonimach) i brakiem współrzędnych w jednym wierszu
with open(OUT / "demo_b_cp1250.csv", "w", newline="", encoding="cp1250") as f:
    w = csv.writer(f, delimiter=";"); w.writerow(["szer_geo", "dl_geo", "ulica", "miejscowosc", "godz", "gdzie"])
    w.writerow([50.0614, 19.9372, "ul. Wzorcowa 10", "Kraków", "24/7", "Przy wejściu"])
    w.writerow(["", "", "ul. Bez Współrzędnych 1", "Kraków", "24/7", "Hol"])  # błąd AED-COORD / REQ

# 3. JSON w stylu OSM (access=customers)
(OUT / "demo_c_osm.json").write_text(json.dumps([
    {"latitude": 54.3520, "longitude": 18.6466, "street": "ul. Demo 1", "city": "Gdańsk", "opening_hours": "24/7", "access": "customers"},
    {"latitude": 51.1079, "longitude": 17.0385, "street": "ul. Demo 2", "city": "Wrocław", "opening_hours": "Mo-Su 09:00-21:00", "access": "yes"},
], ensure_ascii=False, indent=1), encoding="utf-8")

# 4. CSV z duplikatem ~20 m od rekordu z pliku A i rekordem poza Polską
with open(OUT / "demo_d_duplikaty.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, delimiter=","); w.writerow(std)
    w.writerow(["", 52.22875, 21.00360, "Al. Przykładowa 1", "Warszawa", "Recepcja", "calodobowo", "", "brak", "publiczny", "sprawny", "2026-11-01"])
    w.writerow(["", 10.0, 10.0, "Poza Polską", "Nigdzie", "-", "calodobowo", "", "brak", "publiczny", "sprawny", "2026-11-01"])

# 5. XLSX (arkusz „Dane”) z błędną wartością słownika i datą z przyszłości
wb = Workbook(); ws = wb.active; ws.title = "Dane"; ws.append(std)
ws.append(["", 52.4064, 16.9252, "ul. Demo 4", "Poznań", "Basen", "calodobowo", "", "brak", "publiczny", "zepsuty", "2026-11-01"])
ws.append(["", 52.2400, 21.0300, "ul. Demo 9", "Warszawa", "Portiernia", "calodobowo", "", "brak", "publiczny", "sprawny", "2099-01-01"])
wb.save(OUT / "demo_e_xlsx.xlsx")
print("Zapisano:", sorted(p.name for p in OUT.iterdir()))
