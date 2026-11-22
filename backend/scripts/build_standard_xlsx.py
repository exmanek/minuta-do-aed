"""Generuje wzorzec Wzorcowy_zakres_danych_AED.xlsx (v0.2). XLSX jest źródłem prawdy; domain/schema.py go czyta.
Po zmianie pól uruchom: python scripts/build_standard_xlsx.py"""
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font

OUT = Path(__file__).resolve().parent.parent / "data" / "standard" / "Wzorcowy_zakres_danych_AED.xlsx"
VERSION = "0.2"

# (nazwa, status, typ, etykieta, opis, przykład)
FIELDS = [
    ("aed_id", "wymagane", "tekst", "Identyfikator AED", "Nadawany przez system przy tworzeniu; w imporcie może być pusty", "AED-0001"),
    ("lat", "wymagane", "liczba", "Szerokość geograficzna", "WGS84, stopnie dziesiętne. Bez współrzędnych rekord nie trafi na mapę", "52.2286"),
    ("lon", "wymagane", "liczba", "Długość geograficzna", "WGS84, stopnie dziesiętne", "21.0035"),
    ("adres", "wymagane", "tekst", "Adres", "Ulica i numer", "Al. Przykładowa 1"),
    ("kod_pocztowy", "opcjonalne", "tekst", "Kod pocztowy", "Format 00-000", "00-001"),
    ("miasto", "wymagane", "tekst", "Miasto", "Miejscowość", "Warszawa"),
    ("lokalizacja_w_obiekcie", "wymagane", "tekst", "Gdzie dokładnie jest urządzenie", "Opis miejsca w obiekcie, np. hol główny przy recepcji, parter", "Hol główny, przy recepcji"),
    ("dostepnosc", "wymagane", "slownik", "Godziny dostępności", "calodobowo, w_godzinach lub nieznana", "calodobowo"),
    ("godziny_dostepu", "warunkowo_wymagane", "tekst", "Godziny dostępu", "Składnia opening_hours (np. Mo-Fr 08:00-18:00). Wymagane, gdy dostepnosc = w_godzinach", ""),
    ("bariera_dostepu", "wymagane", "slownik", "Fizyczny dostęp do urządzenia", "Jak fizycznie dotrzeć do urządzenia; brak informacji = nieznana", "brak"),
    ("ograniczenia_dostepu", "wymagane", "slownik", "Ograniczenia dostępu", "Kto może wejść do miejsca; brak informacji = nieznane", "publiczny"),
    ("ograniczenia_opis", "opcjonalne", "tekst", "Opis ograniczeń", "Dowolny opis, np. dostęp przez portiera", ""),
    ("stan", "wymagane", "slownik", "Stan urządzenia (gotowość do użycia)", "Czy urządzenie jest gotowe do użycia; brak informacji = nieznany", "sprawny"),
    ("data_ostatniego_przegladu", "opcjonalne", "data", "Data ostatniego przeglądu", "RRRR-MM-DD", "2026-09-01"),
    ("nazwa_dostawcy", "wymagane", "tekst", "Dostawca danych", "Nazwa podmiotu z REGON, który zatwierdza dane", "Dostawca Demo 1"),
    ("regon_dostawcy", "wymagane", "tekst", "REGON dostawcy", "9 lub 14 cyfr. Sprawdzana tylko składnia, nie tożsamość", "123456785"),
    ("dysponent_nazwa", "wymagane", "tekst", "Podmiot zarządzający danymi", "Podmiot prowadzący dane źródłowe (może być tym samym co dostawca)", "Dysponent Demo A"),
    ("dysponent_regon", "opcjonalne", "tekst", "REGON dysponenta", "9 lub 14 cyfr", ""),
    ("zrodlo_danych", "wymagane", "tekst", "Źródło danych", "Nazwa pliku, systemu lub zbioru, z którego pochodzi rekord", "Zbiór demonstracyjny A"),
    ("zakres_referencyjny", "wymagane", "tekst", "Zakres referencyjny", "Krótki opis, co obejmuje źródło (obszar, typy obiektów, stan na)", "Obiekty publiczne, Warszawa, stan na 2026-10-01"),
    ("data_ostatniego_potwierdzenia", "opcjonalne", "data", "Data ostatniego potwierdzenia aktualności", "RRRR-MM-DD. Ustawia tylko jawne potwierdzenie dostawcy. Brak = niepotwierdzone, starsze niż 12 mies. = do_odswiezenia", "2026-11-15"),
    ("data_ostatniej_edycji", "wyliczane", "data", "Data ostatniej edycji", "Ustawia system przy każdej zmianie rekordu", ""),
    ("data_importu", "wyliczane", "data", "Data importu", "Ustawia system przy wczytaniu z pliku", ""),
    ("oswiadczenie_prawdziwosci", "wymagane", "tak_nie", "Oświadczenie o prawdziwości danych", "Składa dostawca przy zatwierdzeniu", "tak"),
]

DICTS = {
    "dostepnosc": ["calodobowo", "w_godzinach", "nieznana"],
    "bariera_dostepu": ["brak", "kod", "klucz", "karta", "obsluga", "nieznana"],
    "ograniczenia_dostepu": ["publiczny", "klienci", "personel", "strefa_zastrzezona", "nieznane"],
    "stan": ["sprawny", "gotowy_do_uzycia", "czasowo_niedostepny", "nieznany"],
    "prawo_do_udostepniania": ["dane_wlasne", "zgoda_dysponenta", "licencja_zrodla_pozwala", "nieustalone"],
    "licencja": ["CC0 1.0", "CC BY 4.0", "CC BY-SA 4.0"],
    "kompletnosc": ["pelna", "czesciowa", "nieznana"],
}

SOURCE_FIELDS = [
    ("nazwa", "wymagane", "tekst", "Nazwa źródła", "", "Zbiór demonstracyjny A"),
    ("url", "opcjonalne", "tekst", "Adres źródła", "", ""),
    ("licencja", "wymagane", "slownik", "Licencja", "Brak licencji blokuje zatwierdzenie (AED-LIC-001)", "CC BY 4.0"),
    ("prawo_do_udostepniania", "wymagane", "slownik", "Podstawa prawa do udostępniania", "nieustalone blokuje zatwierdzenie", "dane_wlasne"),
    ("podstawa_prawa_opis", "opcjonalne", "tekst", "Opis podstawy prawnej", "", ""),
    ("dysponent_nazwa", "wymagane", "tekst", "Podmiot zarządzający danymi", "", "Dysponent Demo A"),
    ("dysponent_regon", "opcjonalne", "tekst", "REGON dysponenta", "", ""),
    ("zakres_referencyjny", "wymagane", "tekst", "Zakres referencyjny", "Obiekt: opis, obszar (nazwa, teryt), typy_obiektow, stan_na, kompletnosc", "Warszawa, obiekty publiczne"),
    ("dane_przykladowe", "wymagane", "tak_nie", "Dane przykładowe", "tak = dane demonstracyjne, oznaczane w eksporcie", "tak"),
]

COMPUTED = [
    ("status_dostepnosci", "Wynik z czterech aspektów: dostepny, ograniczony_dostep, niedostepny, nieznany. Brak informacji to nieznany"),
    ("znacznik_aktualnosci", "aktualne (potwierdzenie do 12 mies.), do_odswiezenia (starsze), niepotwierdzone (brak daty)"),
    ("odleglosc_m", "Odległość od zapytania, metry"),
    ("sygnaly", "Zgłoszenia społeczności, osobno od rekordu oficjalnego"),
    ("zrodla_skladowe", "Źródła składowe rekordu po scaleniu"),
    ("liczba_zrodel", "Liczba źródeł składowych"),
    ("konflikty", "Różnice pól przy scaleniu"),
    ("dane_przykladowe", "tak, gdy rekord pochodzi z danych demonstracyjnych"),
]

SAMPLES = [
    ("DEMO-1", 52.2286, 21.0035, "Al. Przykładowa 1", "00-001", "Warszawa", "Hol główny, przy recepcji", "calodobowo", "", "brak", "publiczny", "", "sprawny", "2026-09-01"),
    ("DEMO-2", 52.2330, 21.0210, "ul. Testowa 5", "00-002", "Warszawa", "Korytarz, I piętro", "w_godzinach", "Mo-Fr 08:00-18:00", "klucz", "personel", "Klucz u portiera", "gotowy_do_uzycia", ""),
    ("DEMO-3", 50.0614, 19.9372, "ul. Wzorcowa 10", "30-001", "Kraków", "Przy wejściu głównym", "nieznana", "", "nieznana", "nieznane", "", "nieznany", ""),
]
SHARED = ["Dostawca Demo 1", "123456785", "Dysponent Demo A", "", "Zbiór demonstracyjny A",
          "Dane demonstracyjne (fikcyjne)", "2026-11-15", "tak"]

wb = Workbook()
bold = Font(bold=True)


def sheet(ws, header, rows, widths=None):
    ws.append(header)
    for c in ws[1]:
        c.font = bold
    for r in rows:
        ws.append(list(r))
    for i, col in enumerate(ws.columns):
        ws.column_dimensions[col[0].column_letter].width = (widths or {}).get(i, 28)


ws = wb.active
ws.title = "Opis pól"
sheet(ws, ["nazwa", "status", "typ", "etykieta", "opis", "przyklad"], FIELDS, {4: 70})
sheet(wb.create_sheet("Słowniki"), ["pole", "wartosc"], [(k, v) for k, vs in DICTS.items() for v in vs])
sheet(wb.create_sheet("Źródła"), ["nazwa", "status", "typ", "etykieta", "opis", "przyklad"], SOURCE_FIELDS, {4: 60})
import_cols = [f[0] for f in FIELDS if f[1] != "wyliczane"]
sheet(wb.create_sheet("Dane"), import_cols, [])
dane_cols = [f[0] for f in FIELDS]
sample_rows = []
for s in SAMPLES:
    row = dict(zip(["aed_id", "lat", "lon", "adres", "kod_pocztowy", "miasto", "lokalizacja_w_obiekcie", "dostepnosc",
                    "godziny_dostepu", "bariera_dostepu", "ograniczenia_dostepu", "ograniczenia_opis", "stan",
                    "data_ostatniego_przegladu"], s))
    row.update(zip(["nazwa_dostawcy", "regon_dostawcy", "dysponent_nazwa", "dysponent_regon", "zrodlo_danych",
                    "zakres_referencyjny", "data_ostatniego_potwierdzenia", "oswiadczenie_prawdziwosci"],
                   ["Dostawca Demo 1", "123456785", "Dysponent Demo A", "", "Zbiór demonstracyjny A",
                    "Dane demonstracyjne (fikcyjne)", "2026-11-15" if s[0] != "DEMO-3" else "", "tak"]))
    sample_rows.append([row.get(c, "") for c in import_cols])
ws = wb.create_sheet("Przykładowe dane")
sheet(ws, import_cols, sample_rows)
ws.append([])
ws.append(["PRZYKŁADOWE, FIKCYJNE DANE DEMONSTRACYJNE. Nie importuj ich jako rzeczywistych."])
sheet(wb.create_sheet("Pola wyliczane"), ["nazwa", "opis"], COMPUTED, {1: 90})
sheet(wb.create_sheet("Instrukcja"), ["Instrukcja dla dostawcy"], [
    (f"Wzorzec zakresu danych AED, wersja {VERSION}.",),
    ("Wypełnij arkusz 'Dane' (wiersz 1 = nagłówki). Pola wyliczane ustawia system.",),
    ("Pola wymagane: patrz 'Opis pól'. Brak informacji zapisz jako 'nieznana'/'nieznane'/'nieznany', nie zgaduj.",),
    ("Dostępność składa się z czterech osobnych aspektów: godziny, fizyczny dostęp, ograniczenia, stan urządzenia.",),
    ("Aktualność: data_ostatniego_potwierdzenia wpisuje się tylko po jawnym potwierdzeniu. Starsza niż 12 miesięcy = do odświeżenia.",),
    ("Poprawny REGON nie jest potwierdzeniem tożsamości. Eksport z aplikacji nie jest publikacją w dane.gov.pl.",),
], {0: 110})
OUT.parent.mkdir(parents=True, exist_ok=True)
wb.save(OUT)
print("Zapisano", OUT)
