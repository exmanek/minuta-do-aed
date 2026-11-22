"""Auto-mapowanie kolumn źródła na pola wzorca i tłumaczenie wartości.
Brak informacji w źródle = 'nieznana'/'nieznane'/'nieznany', nigdy wartość restrykcyjna."""
import difflib
import re
import unicodedata

from ..domain.rules import POLAND_BBOX
from .geo_parse import point_from

# Pola uzupełniane przez system / z opisu źródła (nie muszą być w pliku)
SYSTEM_FIELDS = {"aed_id", "nazwa_dostawcy", "regon_dostawcy", "dysponent_nazwa", "zrodlo_danych",
                 "zakres_referencyjny", "oswiadczenie_prawdziwosci"}
PROVIDER_FIELDS = ("nazwa_dostawcy", "regon_dostawcy")  # zawsze z konta dostawcy, nie z pliku

SYNONYMS = {  # kolejność na liście = priorytet (wcześniejszy synonim wygrywa, gdy kilka kolumn pasuje do jednego pola)
    "aed_id": ["id", "numer_id", "nr_id", "identyfikator", "id_aed"],
    "lat": ["latitude", "szer_geo", "szerokosc", "szerokosc_geograficzna", "wsp_lat"],
    "lon": ["lng", "long", "longitude", "dl_geo", "dlugosc", "dlugosc_geograficzna", "wsp_lon"],
    "adres": ["ulica", "street", "address", "addr_street", "adres_ulica", "nazwa_ulicy"],
    "kod_pocztowy": ["postcode", "postal_code", "zip", "kod", "kod_poczt"],
    "miasto": ["miejscowosc", "city", "town"],
    "lokalizacja_w_obiekcie": ["lokalizacja", "gdzie", "miejsce", "location", "umiejscowienie", "opis_lokalizacji", "name", "nazwa"],
    "godziny_dostepu": ["godziny", "godz", "opening_hours", "godziny_otwarcia"],
    "ograniczenia_dostepu": ["ograniczenia", "access"],
    "stan": ["status", "state", "condition", "stan_urzadzenia"],
    "data_ostatniego_przegladu": ["przeglad", "data_przegladu"],
    "data_ostatniego_potwierdzenia": ["potwierdzenie", "data_potwierdzenia", "check_date", "survey_date"],
    "dysponent_nazwa": ["dysponent", "wlasciciel", "operator"],
    "zrodlo_danych": ["zrodlo"],
}

# Kolumny pomocnicze: nie mapują się 1:1 na pole, ale są wykorzystywane (składanie adresu, współrzędne z geometrii)
GEOM_COLS = ("geometry", "geom", "wkt", "geometria", "the_geom")
STREET_COLS = ("nazwa_ulicy", "ulica", "street", "ul")
NUMBER_COLS = ("nr_budynku", "numer_budynku", "home_number", "house_number", "nr_domu", "numer_domu", "nr_posesji")
APT_COLS = ("nr_lokalu", "numer_lokalu", "apartment")
PREFIX_COLS = ("cecha_ulicy",)
PREFIXES = {"ulica": "ul.", "aleja": "al.", "plac": "pl.", "osiedle": "os."}
AUX_COLS = set(GEOM_COLS) | set(STREET_COLS) | set(NUMBER_COLS) | set(APT_COLS) | set(PREFIX_COLS)
ID_COLS = ("aed_id", "id", "numer_id", "nr_id", "identyfikator", "id_aed")

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
    """-> [{'kolumna','pole','pewnosc'}], pewnosc: wysoka | niska | brak. Zapisany profil ma pierwszeństwo.
    Gdy kilka kolumn pasuje do jednego pola, wygrywa ta o wyższym priorytecie synonimu (np. 'lokalizacja' przed 'nazwa')."""
    fields = mappable_fields(schema)
    lookup = {normalize_name(f): (f, -1) for f in fields}  # ranga -1 = dokładna nazwa pola
    for field, syns in SYNONYMS.items():
        if field in fields:
            for rank, sname in enumerate(syns):
                lookup.setdefault(normalize_name(sname), (field, rank))
    result = {h: (None, "brak") for h in headers}
    best = {}  # pole -> (ranga, kolumna)
    for h in headers:
        if profile and h in profile:
            if profile[h]:
                result[h] = (profile[h], "wysoka")
                best[profile[h]] = (-2, h)
            continue
        hit = lookup.get(normalize_name(h))
        if hit and (hit[0] not in best or hit[1] < best[hit[0]][0]):
            best[hit[0]] = (hit[1], h)
    for field, (_, col) in best.items():
        result[col] = (field, "wysoka")
    used = set(best)
    for h in headers:  # dopasowanie przybliżone (difflib, próg 0,85) dla niedopasowanych
        if result[h][0] is None and not (profile and h in profile) and normalize_name(h) not in AUX_COLS:
            match = difflib.get_close_matches(normalize_name(h), list(lookup), n=1, cutoff=0.85)
            if match and lookup[match[0]][0] not in used:
                used.add(lookup[match[0]][0])
                result[h] = (lookup[match[0]][0], "niska")
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


def _norm_headers(headers):
    return {normalize_name(h): h for h in headers}


def header_notes(headers):
    """Uwagi o kolumnach pomocniczych wykorzystywanych poza mapowaniem 1:1 (wypisywane w kontroli nagłówków)."""
    n, notes = _norm_headers(headers), []
    geo = next((n[g] for g in GEOM_COLS if g in n), None)
    if geo:
        notes.append(f"Współrzędne (gdy nie zmapowano lat/lon) zostaną odczytane z kolumny „{geo}”.")
    street, number = next((n[c] for c in STREET_COLS if c in n), None), next((n[c] for c in NUMBER_COLS if c in n), None)
    if street and number:
        notes.append(f"Adres zostanie złożony z kolumn: {street} + {number}" + (f" + {n['nr_lokalu']}" if "nr_lokalu" in n else "") + ".")
    return notes


def header_check(headers, powtorzone, mapping_list, schema, file_notes=()):
    mapped = {m["pole"] for m in mapping_list if m["pole"]}
    if any(g in _norm_headers(headers) for g in GEOM_COLS):
        mapped |= {"lat", "lon"}  # współrzędne wyliczymy z geometrii
    required = [p["nazwa"] for p in schema["pola"]
                if p["status"] in ("wymagane", "warunkowo_wymagane") and p["nazwa"] not in SYSTEM_FIELDS]
    if "adres" in mapped:
        mapped |= {"miasto", "kod_pocztowy"}  # próbujemy wyodrębnić je z adresu; brak zgłosi walidacja per rekord (AED-REQ-002)
    return {"brakujace": [f for f in required if f not in mapped],
            "nadmiarowe": [m["kolumna"] for m in mapping_list if not m["pole"] and normalize_name(m["kolumna"]) not in AUX_COLS],
            "powtorzone": powtorzone, "uwagi": list(file_notes) + header_notes(headers)}


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


def _in_poland(lat, lon):
    b = POLAND_BBOX
    return isinstance(lat, (int, float)) and isinstance(lon, (int, float)) and b["min_lat"] <= lat <= b["max_lat"] and b["min_lon"] <= lon <= b["max_lon"]


def _first(norm_row, names):
    for n in names:
        v = norm_row.get(n)
        if v not in (None, ""):
            return str(v).strip()
    return None


def _compose_address(rec, norm_row):
    street, number = _first(norm_row, STREET_COLS), _first(norm_row, NUMBER_COLS)
    if not street or not number:
        return
    current = rec.get("adres")
    if current and current != street and re.search(r"\d", current):
        return  # mapowany adres już zawiera numer
    prefix = _first(norm_row, PREFIX_COLS)
    prefix = PREFIXES.get(normalize_name(prefix), prefix) if prefix else None
    apt = _first(norm_row, APT_COLS)
    rec["adres"] = " ".join(x for x in (prefix, street, number + (f"/{apt}" if apt else "")) if x)


def _split_address(rec):
    """„ul. Jasna, 38-400 Krosno” -> adres, kod_pocztowy, miasto (tylko uzupełnia puste pola)."""
    m = re.match(r"^(.*?),\s*(\d{2}-\d{3})\s+(.+)$", rec.get("adres") or "")
    if m:
        rec["adres"] = m.group(1).strip()
        rec["kod_pocztowy"] = rec.get("kod_pocztowy") or m.group(2)
        rec["miasto"] = rec.get("miasto") or m.group(3).strip()


def build_record(row, mapping, schema):
    """Wiersz źródła -> rekord z nazwami pól wzorca (zmapowane kolumny + kolumny pomocnicze), wartości przetłumaczone.
    Zmiany „naprawcze” (zamiana lat/lon) są oznaczane w rec['_flagi'] i raportowane w walidacji."""
    rec, flags = {}, []
    for col, pole in mapping.items():
        if pole and col in row:
            v = row[col]
            rec[pole] = v.strip() or None if isinstance(v, str) else v
    norm_row = {normalize_name(k): v for k, v in row.items()}
    for f in ("lat", "lon"):
        if rec.get(f) is not None:
            rec[f] = _num(rec[f])
    if rec.get("lat") in (None, "") or rec.get("lon") in (None, ""):  # współrzędne z kolumny geometrii
        pt = next((point_from(norm_row[g]) for g in GEOM_COLS if norm_row.get(g)), None)
        if pt:
            rec["lat"], rec["lon"] = pt
    lat, lon = rec.get("lat"), rec.get("lon")
    if not _in_poland(lat, lon) and _in_poland(lon, lat):  # odwrócone lat/lon (np. nagłówek „Długość” przy wartościach lat)
        rec["lat"], rec["lon"] = lon, lat
        flags.append("zamieniono_lat_lon")
    _compose_address(rec, norm_row)
    _split_address(rec)
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
    if flags:
        rec["_flagi"] = flags
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
