from datetime import date, datetime

from app.domain.schema import load_schema
from app.config import Config
from app.services import dedupe, ingest, mapping, validation
from app.services.availability import TZ, compute_status, is_open, parse_hours

import pytest
from app.errors import ApiError

SCHEMA = load_schema(Config.STANDARD_XLSX)


def test_ingest_rejects_pdf_doc():
    for name in ("a.pdf", "a.doc", "a.docx", "a.xls", "a.xlsm"):
        with pytest.raises(ApiError) as e:
            ingest.parse_file(name, b"x")
        assert e.value.status == 415


def test_ingest_cp1250_and_separator():
    raw = "ulica;miasto\nŁąkowa 1;Łódź\n".encode("cp1250")
    p = ingest.parse_file("x.csv", raw)
    assert p["kodowanie"] == "cp1250" and p["separator"] == ";" and p["wiersze"][0]["miasto"] == "Łódź"


def test_ingest_duplicated_headers_reported():
    p = ingest.parse_file("x.csv", b"a,a,b\n1,2,3\n")
    assert p["powtorzone"] == ["a"] and p["wiersze"][0] == {"a": "1", "b": "3"}


def test_mapping_synonyms_and_fuzzy():
    m = {x["kolumna"]: x for x in mapping.propose_mapping(["szer_geo", "Długość", "adress", "kolumna_x"], SCHEMA)}
    assert m["szer_geo"]["pole"] == "lat" and m["szer_geo"]["pewnosc"] == "wysoka"
    assert m["Długość"]["pole"] == "lon"
    assert m["adress"]["pole"] == "adres" and m["adress"]["pewnosc"] == "niska"
    assert m["kolumna_x"]["pole"] is None


def test_mapping_values_unknown_is_not_restrictive():
    rec = mapping.build_record({"a": "52,5", "b": "24/7", "c": "customers"},
                               {"a": "lat", "b": "godziny_dostepu", "c": "ograniczenia_dostepu"}, SCHEMA)
    assert rec["lat"] == 52.5 and rec["dostepnosc"] == "calodobowo" and rec["ograniczenia_dostepu"] == "klienci"
    assert rec["stan"] == "nieznany" and rec["bariera_dostepu"] == "nieznana"


def test_hours_parser():
    h = parse_hours("Mo-Fr 08:00-12:00,13:00-17:00; Sa 10:00-14:00; Su off")
    mon = datetime(2026, 11, 23, 9, 0, tzinfo=TZ)
    assert is_open(h, mon) and not is_open(h, mon.replace(hour=12, minute=30))
    assert not is_open(h, datetime(2026, 11, 29, 9, 0, tzinfo=TZ)) and parse_hours("cos dziwnego") is None
    night = parse_hours("Mo-Su 22:00-02:00")
    assert is_open(night, datetime(2026, 11, 23, 1, 0, tzinfo=TZ)) and not is_open(night, datetime(2026, 11, 23, 12, 0, tzinfo=TZ))


def _rec(**kw):
    base = {"dostepnosc": "calodobowo", "bariera_dostepu": "brak", "ograniczenia_dostepu": "publiczny", "stan": "sprawny"}
    return {**base, **kw}


def test_status_order_and_unknown_never_unavailable():
    now = datetime(2026, 11, 23, 12, 0, tzinfo=TZ)
    assert compute_status(_rec(), now)["wartosc"] == "dostepny"
    assert compute_status(_rec(stan="czasowo_niedostepny"), now)["wartosc"] == "niedostepny"
    assert compute_status(_rec(bariera_dostepu="klucz"), now)["wartosc"] == "ograniczony_dostep"
    assert compute_status(_rec(stan="nieznany"), now)["wartosc"] == "nieznany"
    s = compute_status(_rec(dostepnosc="w_godzinach", godziny_dostepu="cos"), now)
    assert s["wartosc"] == "nieznany" and "godziny_dostepu" in s["brakujace"]
    assert compute_status(_rec(dostepnosc="w_godzinach", godziny_dostepu="Mo-Fr 08:00-09:00"), now)["wartosc"] == "niedostepny"
    assert compute_status({}, now)["wartosc"] == "nieznany"


def test_validation_rules():
    good = {"lat": 52.2, "lon": 21.0, "dostepnosc": "calodobowo", "stan": "sprawny", "nazwa_dostawcy": "x",
            "regon_dostawcy": "123456785", "dysponent_nazwa": "d", "zrodlo_danych": "z", "zakres_referencyjny": "r",
            "adres": "a", "miasto": "m", "lokalizacja_w_obiekcie": "l", "bariera_dostepu": "brak",
            "ograniczenia_dostepu": "publiczny", "data_ostatniego_potwierdzenia": "2026-11-01"}
    today = date(2026, 11, 22)
    codes = lambda r: {i["regula"] for i in validation.validate_record(r, SCHEMA, "x", 365, today)}
    assert codes(good) == set()
    assert "AED-COORD-001" in codes({**good, "lat": "abc"})
    assert "AED-COORD-002" in codes({**good, "lat": 10.0, "lon": 10.0})
    assert "AED-REQ-001" in codes({**good, "lat": None})
    assert "AED-DICT-001" in codes({**good, "stan": "zepsuty"})
    assert "AED-DATE-002" in codes({**good, "data_ostatniego_potwierdzenia": "2099-01-01"})
    assert "AED-DATE-001" in codes({**good, "data_ostatniego_potwierdzenia": "15.11.2026"})
    assert "AED-FRESH-001" in codes({**good, "data_ostatniego_potwierdzenia": "2024-01-01"})
    assert "AED-FRESH-001" in codes({**good, "data_ostatniego_potwierdzenia": None})
    assert "AED-PROV-001" in codes({**good, "regon_dostawcy": "123456789"})
    assert "AED-AVAIL-001" in codes({**good, "dostepnosc": "w_godzinach"})
    assert "AED-AVAIL-003" in codes({**good, "dostepnosc": "w_godzinach", "godziny_dostepu": "jakos"})
    assert "AED-AVAIL-002" in codes({**good, "stan": "nieznany"})


def test_source_rules():
    ids = lambda s: {i["regula"] for i in validation.validate_source(s, SCHEMA)}
    ok = {"zakres": {"opis": "x"}, "licencja": "CC BY 4.0", "prawo_do_udostepniania": "dane_wlasne"}
    assert ids(ok) == set()
    assert ids({**ok, "zakres": None}) == {"AED-SRC-001"}
    assert ids({**ok, "prawo_do_udostepniania": "nieustalone"}) == {"AED-LIC-001"}
    assert ids({**ok, "licencja": None}) == {"AED-LIC-001"}


def test_dedupe_classes():
    items = [{"ref": "a", "lat": 52.0, "lon": 21.0, "adres": "Al. Przykładowa 1"},
             {"ref": "b", "lat": 52.0002, "lon": 21.0, "adres": "Al. Przykladowa 1"},
             {"ref": "c", "lat": 52.0002, "lon": 21.0, "adres": "zupelnie inna ulica 99"}]
    c = {(x["aed_a"], x["aed_b"]): x for x in dedupe.find_candidates(items, lambda *a: [])}
    assert c[("a", "b")]["pewnosc"] == "prawdopodobny" and c[("a", "c")]["pewnosc"] == "mozliwy"
