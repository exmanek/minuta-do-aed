"""Auto-mapowanie kolumn źródła na pola wzorca i tłumaczenie wartości.
Brak informacji w źródle = 'nieznana'/'nieznane'/'nieznany', nigdy wartość restrykcyjna."""
import difflib
import re
import unicodedata

from ..errors import ApiError

# Pola uzupełniane przez system / z opisu źródła (nie muszą być w pliku)
SYSTEM_FIELDS = {"aed_id", "nazwa_dostawcy", "regon_dostawcy", "dysponent_nazwa", "zrodlo_danych",
                 "zakres_referencyjny", "oswiadczenie_prawdziwosci"}
PROVIDER_FIELDS = ("nazwa_dostawcy", "regon_dostawcy")  # zawsze z konta dostawcy, nie z pliku

SYNONYMS = {
    "aed_id": ["id", "identyfikator", "id_aed"],
    "lat": ["latitude", "szer_geo", "szerokosc", "szerokosc_geograficzna", "wsp_lat"],
    "lon": ["lng", "long", "longitude", "dl_geo", "dlugosc", "dlugosc_geograficzna", "wsp_lon"],
    "adres": ["ulica", "street", "address", "addr_street", "adres_ulica"],
    "kod_pocztowy": ["kod", "postcode", "zip", "kod_poczt"],
    "miasto": ["miejscowosc", "city", "town"],
    "lokalizacja_w_obiekcie": ["lokalizacja", "gdzie", "miejsce", "location", "umiejscowienie", "opis_lokalizacji"],
    "godziny_dostepu": ["godziny", "godz", "opening_hours", "godziny_otwarcia"],
    "ograniczenia_dostepu": ["ograniczenia", "access"],
    "stan": ["status", "state", "condition", "stan_urzadzenia"],
    "data_ostatniego_przegladu": ["przeglad", "data_przegladu"],
    "data_ostatniego_potwierdzenia": ["potwierdzenie", "data_potwierdzenia", "check_date", "survey_date"],
    "dysponent_nazwa": ["dysponent", "wlasciciel", "operator"],
    "zrodlo_danych": ["zrodlo"],
}

VALUE_ALIASES = {
    "dostepnosc": {"24_7": "calodobowo", "24h": "calodobowo", "caly_dzien": "calodobowo", "w_godzinach_otwarcia": "w_godzinach"},
    "ograniczenia_dostepu": {"yes": "publiczny", "public": "publiczny", "tak": "publiczny", "customers": "klienci",
                             "private": "strefa_zastrzezona", "permit": "strefa_zastrzezona", "no": "strefa_zastrzezona",
                             "staff": "personel", "pracownicy": "personel"},
    "bariera_dostepu": {"none": "brak", "nie": "brak", "key": "klucz", "code": "kod", "card": "karta", "staff": "obsluga"},
    "stan": {"ok": "sprawny", "working": "sprawny", "dziala": "sprawny", "unavailable": "czasowo_niedostepny"},
}
UNKNOWN = {"dostepnosc": "nieznana", "bariera_dostepu": "nieznana", "ograniczenia_dostepu": "nieznane", "stan": "nieznany"}


def normalize_name(name):
    s = str(name).lower().replace("ł", "l")
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def mappable_fields(schema):
    return [p["nazwa"] for p in schema["pola"] if p["status"] != "wyliczane"]


def propose_mapping(headers, schema, profile=None):
    """-> [{'kolumna','pole','pewnosc'}], pewnosc: wysoka | niska | brak. Zapisany profil ma pierwszeństwo."""
    fields = mappable_fields(schema)
    lookup = {normalize_name(f): f for f in fields}
    for field, syns in SYNONYMS.items():
        if field in fields:
            for s in syns:
                lookup.setdefault(normalize_name(s), field)
    result, used = {}, set()
    for h in headers:  # 1) profil i dopasowanie dokładne / po synonimie
        if profile and h in profile:
            pole = profile[h]
            result[h] = (pole, "wysoka" if pole else "brak")
        else:
            pole = lookup.get(normalize_name(h))
            result[h] = (pole, "wysoka") if pole else (None, "brak")
        if result[h][0]:
            if result[h][0] in used:
                result[h] = (None, "brak")
            else:
                used.add(result[h][0])
    for h in headers:  # 2) dopasowanie przybliżone (difflib, próg 0,85)
        if result[h][0] is None and not (profile and h in profile):
            match = difflib.get_close_matches(normalize_name(h), list(lookup), n=1, cutoff=0.85)
            if match and lookup[match[0]] not in used:
                used.add(lookup[match[0]])
                result[h] = (lookup[match[0]], "niska")
    return [{"kolumna": h, "pole": result[h][0], "pewnosc": result[h][1]} for h in headers]


def validate_mapping(mapping, schema, headers):
    """Zwraca listę problemów (puste = poprawne). Pola spoza wzorca i dublowanie pola są błędem."""
    allowed, problems, seen = set(mappable_fields(schema)), [], {}
    for col, pole in mapping.items():
        if col not in headers:
            problems.append({"kolumna": col, "komunikat": "Nieznana kolumna źródła."})
        elif pole is not None and pole not in allowed:
            problems.append({"kolumna": col, "pole": pole, "komunikat": "Pole spoza wzorca XLSX."})
        elif pole is not None:
            if pole in seen:
                problems.append({"kolumna": col, "pole": pole, "komunikat": f"Pole już zmapowane z kolumny '{seen[pole]}'."})
            seen[pole] = col
    return problems


def header_check(headers, powtorzone, mapping_list, schema):
    mapped = {m["pole"] for m in mapping_list if m["pole"]}
    required = [p["nazwa"] for p in schema["pola"]
                if p["status"] in ("wymagane", "warunkowo_wymagane") and p["nazwa"] not in SYSTEM_FIELDS]
    return {"brakujace": [f for f in required if f not in mapped],
            "nadmiarowe": [m["kolumna"] for m in mapping_list if not m["pole"]],
            "powtorzone": powtorzone}


def _num(v):
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).strip().replace(",", "."))
    except ValueError:
        return v  # zostaje tekst -> walidacja zgłosi AED-COORD-001


def _canon(field, value, schema):
    n = normalize_name(value)
    allowed = schema["slowniki"].get(field, [])
    for a in allowed:
        if normalize_name(a) == n:
            return a
    return VALUE_ALIASES.get(field, {}).get(n, value)


def build_record(row, mapping, schema):
    """Wiersz źródła -> rekord z nazwami pól wzorca (tylko zmapowane kolumny), wartości przetłumaczone."""
    rec = {}
    for col, pole in mapping.items():
        if pole and col in row:
            v = row[col]
            rec[pole] = v.strip() or None if isinstance(v, str) else v
    for f in ("lat", "lon"):
        if rec.get(f) is not None:
            rec[f] = _num(rec[f])
    for f in UNKNOWN:
        if rec.get(f) is not None:
            rec[f] = _canon(f, rec[f], schema)
    godz = rec.get("godziny_dostepu")
    if godz and normalize_name(godz) == "24_7":  # 24/7 -> calodobowo
        rec["godziny_dostepu"] = None
        if not rec.get("dostepnosc"):
            rec["dostepnosc"] = "calodobowo"
    elif godz and not rec.get("dostepnosc"):
        rec["dostepnosc"] = "w_godzinach"
    for f, unknown in UNKNOWN.items():
        if not rec.get(f):
            rec[f] = unknown
    return rec


def fill_system_fields(rec, source, provider):
    """Pola dostawcy/źródła z konta i opisu źródła. Dostawca zawsze z konta; reszta: wartość z pliku ma pierwszeństwo."""
    zakres = source.get("zakres")
    zakres_text = zakres.get("opis") if isinstance(zakres, dict) else zakres
    rec["nazwa_dostawcy"], rec["regon_dostawcy"] = provider["nazwa"], provider["regon"]
    rec.setdefault("dysponent_nazwa", None)
    rec["dysponent_nazwa"] = rec["dysponent_nazwa"] or source.get("dysponent_nazwa")
    rec["dysponent_regon"] = rec.get("dysponent_regon") or source.get("dysponent_regon")
    rec["zrodlo_danych"] = rec.get("zrodlo_danych") or source["nazwa"]
    rec["zakres_referencyjny"] = rec.get("zakres_referencyjny") or zakres_text
    rec["dane_przykladowe"] = bool(source.get("dane_przykladowe"))
    rec["aed_id"] = None  # nadawany przy zatwierdzeniu; id z pliku to source_record_id
    return rec
