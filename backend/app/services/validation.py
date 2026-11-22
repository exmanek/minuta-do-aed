"""Reguły walidacji (kody w domain/rules.py). Wynik to lista problemów, nigdy wyjątek."""
import re
from datetime import date

from ..domain import rules
from ..domain.rules import issue
from .availability import parse_hours
from .freshness import znacznik_aktualnosci
from .regon import is_valid_regon_format

_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _blank(v):
    return v is None or (isinstance(v, str) and not v.strip())


def _is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _parse_date(v):
    if isinstance(v, date):
        return v
    if not isinstance(v, str) or not _ISO.match(v):
        return None
    try:
        return date.fromisoformat(v)
    except ValueError:
        return None


def validate_record(rec, schema, ref=None, prog_dni=365, today=None):
    today = today or date.today()
    out = []
    add = lambda code, pole=None, msg=None: out.append(issue(code, pole, ref, msg))

    for f in rules.CRITICAL_FIELDS:
        if _blank(rec.get(f)):
            add("AED-REQ-001", f, f"Brak pola krytycznego: {f}.")
    for f in rules.NONCRITICAL_REQUIRED_FIELDS:
        if _blank(rec.get(f)):
            add("AED-REQ-002", f, f"Brak pola wymaganego: {f}.")

    for f in ("lat", "lon"):
        if not _blank(rec.get(f)) and not _is_num(rec[f]):
            add("AED-COORD-001", f, f"Współrzędna {f} nie jest liczbą.")
    if _is_num(rec.get("lat")) and _is_num(rec.get("lon")):
        b = rules.POLAND_BBOX
        if not (b["min_lat"] <= rec["lat"] <= b["max_lat"] and b["min_lon"] <= rec["lon"] <= b["max_lon"]):
            add("AED-COORD-002", "lat", "Współrzędne poza przybliżonym obszarem Polski.")

    if "zamieniono_lat_lon" in (rec.get("_flagi") or []):
        add("AED-COORD-003", "lat")

    for p in schema["pola"]:
        if p["typ"] == "slownik" and not _blank(rec.get(p["nazwa"])):
            allowed = schema["slowniki"].get(p["nazwa"], [])
            if rec[p["nazwa"]] not in allowed:
                add("AED-DICT-001", p["nazwa"], f"Wartość '{rec[p['nazwa']]}' spoza słownika ({', '.join(allowed)}).")

    if rec.get("dostepnosc") == "w_godzinach":
        if _blank(rec.get("godziny_dostepu")):
            add("AED-AVAIL-001", "godziny_dostepu")
        elif parse_hours(rec["godziny_dostepu"]) is None:
            add("AED-AVAIL-003", "godziny_dostepu")
    unknown = [f for f, u in (("bariera_dostepu", "nieznana"), ("ograniczenia_dostepu", "nieznane"), ("stan", "nieznany"))
               if _blank(rec.get(f)) or rec.get(f) == u]
    if unknown:
        add("AED-AVAIL-002", unknown[0], "Brak informacji (nie oznacza niedostępności): " + ", ".join(unknown) + ".")

    for p in schema["pola"]:
        if p["typ"] == "data" and not _blank(rec.get(p["nazwa"])):
            d = _parse_date(rec[p["nazwa"]])
            if d is None:
                add("AED-DATE-001", p["nazwa"], f"Data '{rec[p['nazwa']]}' w złym formacie (wymagane RRRR-MM-DD).")
            elif p["nazwa"] in ("data_ostatniego_potwierdzenia", "data_ostatniej_edycji") and d > today:
                add("AED-DATE-002", p["nazwa"])
    conf = rec.get("data_ostatniego_potwierdzenia")
    if znacznik_aktualnosci(conf if _parse_date(conf) else None, prog_dni, today) != "aktualne":
        add("AED-FRESH-001", "data_ostatniego_potwierdzenia")

    if not is_valid_regon_format(str(rec.get("regon_dostawcy") or "")):
        add("AED-PROV-001", "regon_dostawcy")
    if not _blank(rec.get("dysponent_regon")) and not is_valid_regon_format(str(rec["dysponent_regon"])):
        add("AED-PROV-001", "dysponent_regon", "Niepoprawny format REGON dysponenta.")
    return out


def validate_source(source, schema, ref=None):
    out = []
    z = source.get("zakres")
    if _blank(z.get("opis") if isinstance(z, dict) else z):
        out.append(issue("AED-SRC-001", "zakres_referencyjny", ref))
    lic, prawo = source.get("licencja"), source.get("prawo_do_udostepniania")
    if _blank(lic) or _blank(prawo) or prawo == "nieustalone":
        out.append(issue("AED-LIC-001", "licencja" if _blank(lic) else "prawo_do_udostepniania", ref))
    else:
        for f, v in (("licencja", lic), ("prawo_do_udostepniania", prawo)):
            if v not in schema["slowniki"].get(f, []):
                out.append(issue("AED-DICT-001", f, ref, f"Wartość '{v}' spoza słownika źródła."))
    return out


def has_blocking(issues):
    return any(i["poziom"] == rules.BLAD for i in issues)
