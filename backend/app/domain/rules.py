"""Kody reguł walidacji i ich poziomy (dokumentacja v2, pkt 4.3).
'blad' blokuje zatwierdzenie, 'ostrzezenie' nie. Listy pól blokujących trzymamy tutaj, nie w kodzie reguł."""

BLAD, OSTRZEZENIE = "blad", "ostrzezenie"

# Pola krytyczne: brak = AED-REQ-001 (błąd). Muszą istnieć w wzorcu XLSX (pilnuje test).
CRITICAL_FIELDS = (
    "lat", "lon", "dostepnosc", "stan", "nazwa_dostawcy", "regon_dostawcy",
    "dysponent_nazwa", "zrodlo_danych", "zakres_referencyjny",
)
# Wymagane niekrytyczne: brak = AED-REQ-002 (ostrzeżenie).
NONCRITICAL_REQUIRED_FIELDS = ("adres", "miasto", "lokalizacja_w_obiekcie")

# Przybliżony prostokąt Polski dla AED-COORD-002.
POLAND_BBOX = {"min_lat": 49.0, "max_lat": 54.9, "min_lon": 14.1, "max_lon": 24.2}

RULES = {
    "AED-REQ-001": (BLAD, "Brak pola krytycznego."),
    "AED-REQ-002": (OSTRZEZENIE, "Brak pola wymaganego niekrytycznego."),
    "AED-DICT-001": (BLAD, "Wartość spoza słownika."),
    "AED-COORD-001": (BLAD, "Współrzędne nie są liczbami."),
    "AED-COORD-002": (OSTRZEZENIE, "Współrzędne poza przybliżonym obszarem Polski."),
    "AED-AVAIL-001": (OSTRZEZENIE, "Brak godzin dostępu, gdy dostepnosc = w_godzinach."),
    "AED-AVAIL-002": (OSTRZEZENIE, "Brak informacji o dostępności (to nie oznacza niedostępności)."),
    "AED-AVAIL-003": (OSTRZEZENIE, "Godziny w składni, której parser nie rozumie."),
    "AED-DATE-001": (BLAD, "Data w złym formacie (wymagane RRRR-MM-DD)."),
    "AED-DATE-002": (BLAD, "Data z przyszłości."),
    "AED-FRESH-001": (OSTRZEZENIE, "Brak potwierdzenia aktualności lub starsze niż próg."),
    "AED-PROV-001": (BLAD, "Brak lub niepoprawny format REGON dostawcy."),
    "AED-PROV-002": (BLAD, "Brak wymaganych oświadczeń."),
    "AED-SRC-001": (BLAD, "Źródło bez zakresu referencyjnego."),
    "AED-LIC-001": (BLAD, "Źródło bez licencji lub z prawem do udostępniania 'nieustalone'."),
    "AED-DUP-001": (OSTRZEZENIE, "Nierozstrzygnięty kandydat na duplikat."),
}


def level(code):
    return RULES[code][0]


def issue(code, pole=None, aed_id=None, komunikat=None):
    """Element listy problemów w formacie z kontraktu (details / raport)."""
    return {"aed_id": aed_id, "pole": pole, "regula": code, "poziom": level(code),
            "komunikat": komunikat or RULES[code][1]}
