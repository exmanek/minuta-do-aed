"""Generuje TYMCZASOWY plik Wzorcowy_zakres_danych_AED.xlsx (v0.2-szkic) z pól opisanych w dokumentacji v2.
Należy go ZASTĄPIĆ oficjalnym wzorcem zespołu. Układ zakładek: 'Opis pól' i 'Słowniki' czyta domain/schema.py."""
from pathlib import Path
from openpyxl import Workbook

OUT = Path(__file__).resolve().parent.parent / "data" / "standard" / "Wzorcowy_zakres_danych_AED.xlsx"

# (nazwa, status, typ, etykieta, opis)
FIELDS = [
    ("aed_id", "wymagane", "tekst", "Identyfikator AED", "Nadawany przez system przy tworzeniu"),
    ("lat", "wymagane", "liczba", "Szerokość geograficzna", "WGS84"),
    ("lon", "wymagane", "liczba", "Długość geograficzna", "WGS84"),
    ("adres", "wymagane", "tekst", "Adres", ""),
    ("miasto", "wymagane", "tekst", "Miasto", ""),
    ("dostepnosc", "wymagane", "slownik", "Godziny dostępności", "calodobowo / w_godzinach / nieznana"),
    ("godziny_dostepu", "warunkowo_wymagane", "tekst", "Godziny dostępu", "Składnia opening_hours; wymagane gdy w_godzinach"),
    ("bariera_dostepu", "wymagane", "slownik", "Fizyczny dostęp do urządzenia", ""),
    ("ograniczenia_dostepu", "wymagane", "slownik", "Ograniczenia dostępu", ""),
    ("ograniczenia_opis", "opcjonalne", "tekst", "Opis ograniczeń", ""),
    ("stan", "wymagane", "slownik", "Stan urządzenia", ""),
    ("nazwa_dostawcy", "wymagane", "tekst", "Dostawca danych", ""),
    ("regon_dostawcy", "wymagane", "tekst", "REGON dostawcy", "Tylko format i suma kontrolna"),
    ("dysponent_nazwa", "wymagane", "tekst", "Podmiot zarządzający danymi", ""),
    ("dysponent_regon", "opcjonalne", "tekst", "REGON dysponenta", ""),
    ("zrodlo_danych", "wymagane", "tekst", "Źródło danych", ""),
    ("zakres_referencyjny", "wymagane", "tekst", "Zakres referencyjny", "Krótki opis zakresu głównego źródła"),
    ("data_ostatniego_potwierdzenia", "opcjonalne", "data", "Data ostatniego potwierdzenia", "RRRR-MM-DD; brak = niepotwierdzone"),
    ("data_ostatniej_edycji", "wyliczane", "data", "Data ostatniej edycji", "Ustawia system"),
    ("data_importu", "wyliczane", "data", "Data importu", "Ustawia system"),
    ("oswiadczenie_prawdziwosci", "wymagane", "tak_nie", "Oświadczenie o prawdziwości", ""),
]
DICTS = {
    "dostepnosc": ["calodobowo", "w_godzinach", "nieznana"],
    "bariera_dostepu": ["brak", "kod", "klucz", "karta", "obsluga", "nieznana"],
    "ograniczenia_dostepu": ["publiczny", "klienci", "personel", "strefa_zastrzezona", "nieznane"],
    "stan": ["sprawny", "gotowy_do_uzycia", "czasowo_niedostepny", "nieznany"],
}

wb = Workbook()
ws = wb.active
ws.title = "Opis pól"
ws.append(["nazwa", "status", "typ", "etykieta", "opis"])
for f in FIELDS:
    ws.append(list(f))
ws2 = wb.create_sheet("Słowniki")
ws2.append(["pole", "wartosc"])
for pole, vals in DICTS.items():
    for v in vals:
        ws2.append([pole, v])
ws3 = wb.create_sheet("Dane")
ws3.append([f[0] for f in FIELDS if f[1] != "wyliczane"])
ws4 = wb.create_sheet("README")
ws4.append(["TYMCZASOWY SZKIC (v0.2-szkic) wygenerowany ze skryptu build_standard_stub.py. Zastąp oficjalnym wzorcem."])
OUT.parent.mkdir(parents=True, exist_ok=True)
wb.save(OUT)
print("Zapisano", OUT)
