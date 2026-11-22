"""Parser podzbioru opening_hours i wyliczanie status_dostepnosci z czterech aspektów.
Brak informacji prowadzi do 'nieznany', nigdy do 'niedostepny'. Strefa: Europe/Warsaw."""
import re
from datetime import datetime
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Warsaw")
DAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"]
_TIME = r"\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}"
_RULE = re.compile(rf"^(?:(?P<days>[A-Za-z]{{2}}(?:\s*[-,]\s*[A-Za-z]{{2}})*)\s+)?(?P<t>off|{_TIME}(?:\s*,\s*{_TIME})*)$", re.I)


def _hm(s):
    h, m = (int(x) for x in s.strip().split(":"))
    if m > 59 or h > 24 or (h == 24 and m):
        raise ValueError
    return h * 60 + m


def _days(spec):
    out = set()
    for part in re.split(r"\s*,\s*", spec):
        ends = [p.strip().lower() for p in part.split("-")]
        if any(e not in DAYS for e in ends):
            raise ValueError
        a = DAYS.index(ends[0])
        b = DAYS.index(ends[-1])
        out.update(range(a, b + 1) if a <= b else list(range(a, 7)) + list(range(0, b + 1)))
    return out


def parse_hours(text):
    """-> {dzien(0=Mo): [(start_min, end_min)]} albo None, gdy składnia niezrozumiała."""
    if not text or not str(text).strip():
        return None
    s = str(text).strip()
    if s.lower() == "24/7":
        return {d: [(0, 1440)] for d in range(7)}
    res = {d: [] for d in range(7)}
    try:
        for part in (p.strip() for p in s.split(";") if p.strip()):
            m = _RULE.match(part)
            if not m:
                return None
            days = _days(m.group("days")) if m.group("days") else set(range(7))
            t = m.group("t")
            ranges = [] if t.lower() == "off" else [tuple(_hm(x) for x in r.split("-")) for r in re.split(r"\s*,\s*", t)]
            for d in days:  # późniejsza reguła nadpisuje wcześniejszą (jak w opening_hours)
                res[d] = list(ranges)
    except ValueError:
        return None
    return res


def is_open(hours, now):
    d, minute = now.weekday(), now.hour * 60 + now.minute
    if any(s <= minute < e for s, e in hours[d] if e > s):
        return True
    if any(minute >= s for s, e in hours[d] if e <= s):  # zakres przez północ, część wieczorna
        return True
    return any(minute < e for s, e in hours[(d - 1) % 7] if e <= s)  # ... i poranna z poprzedniego dnia


def _empty(v):
    return v in (None, "")


def compute_status(rec, now=None):
    now = (now or datetime.now(TZ)).astimezone(TZ)
    dost, bar, ogr, stan = (rec.get(k) for k in ("dostepnosc", "bariera_dostepu", "ograniczenia_dostepu", "stan"))
    hours = parse_hours(rec.get("godziny_dostepu")) if dost == "w_godzinach" else None
    missing = [k for k, v, unk in (("dostepnosc", dost, "nieznana"), ("bariera_dostepu", bar, "nieznana"),
                                   ("ograniczenia_dostepu", ogr, "nieznane"), ("stan", stan, "nieznany"))
               if _empty(v) or v == unk]
    if dost == "w_godzinach" and hours is None:
        missing.append("godziny_dostepu")

    def out(value, powod):
        return {"wartosc": value, "powod": powod, "brakujace": missing, "na_chwile": now.isoformat(timespec="seconds")}

    if stan == "czasowo_niedostepny":
        return out("niedostepny", "urządzenie czasowo niedostępne")
    if dost == "w_godzinach" and hours is not None and not is_open(hours, now):
        return out("niedostepny", f"poza godzinami dostępności ({rec.get('godziny_dostepu')})")
    reasons = []
    if bar in ("kod", "klucz", "karta", "obsluga"):
        reasons.append(f"dostęp przez: {bar}")
    if ogr in ("klienci", "personel", "strefa_zastrzezona"):
        reasons.append(f"ograniczenia: {ogr}")
    if reasons:
        return out("ograniczony_dostep", ", ".join(reasons))
    if missing:
        return out("nieznany", "brak danych o: " + ", ".join(missing))
    when = "całodobowo" if dost == "calodobowo" else "teraz w godzinach dostępności"
    return out("dostepny", f"{when}, bez bariery, bez ograniczeń, urządzenie gotowe")
