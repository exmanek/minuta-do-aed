"""Prawdziwe próbki z dane.gov.pl: niejednorodne nagłówki, zepsuty CSV, geometria, adresy, odwrócone współrzędne."""
import json

from app.config import Config
from app.domain.schema import load_schema
from app.services import geo_parse, ingest, mapping
from danegov_fakes import FIX

SCHEMA = load_schema(Config.STANDARD_XLSX)


def records(fixture, filename=None):
    parsed = ingest.parse_file(filename or fixture, (FIX / fixture).read_bytes())
    prop = mapping.propose_mapping(parsed["naglowki"], SCHEMA)
    m = {x["kolumna"]: x["pole"] for x in prop}
    return parsed, m, [mapping.build_record(r, m, SCHEMA) for r in parsed["wiersze"]]


def test_geo_parse_formats():
    assert geo_parse.point_from({"type": "Point", "coordinates": [22.7, 49.8]}) == (49.8, 22.7)
    assert geo_parse.point_from('{"type":"Point","coordinates":{"lat":"49.78","long":"22.77"}}') == (49.78, 22.77)
    assert geo_parse.point_from("POINT (21.0 52.2)") == (52.2, 21.0)
    assert geo_parse.point_from({"lat": 1, "lng": 2}) == (1.0, 2.0)
    assert geo_parse.point_from("nie geometria") is None and geo_parse.point_from(None) is None


def test_marki_double_quoted_csv_is_unwrapped():
    parsed, m, recs = records("marki.csv")
    assert parsed["naglowki"] == ["Długość geograficzna", "Szerokość geograficzna", "Nazwa", "Lokalizacja", "Adres", "Numer Id"]
    assert len(parsed["wiersze"]) == 8 and any("rozpakowany" in n for n in parsed["uwagi"])
    assert m["Lokalizacja"] == "lokalizacja_w_obiekcie" and "Nazwa" not in {k for k, v in m.items() if v}  # 'lokalizacja' > 'nazwa'


def test_marki_reversed_coordinates_are_swapped_and_flagged():
    _, _, recs = records("marki.csv")
    first = recs[0]
    assert (first["lat"], first["lon"]) == (52.326697, 21.107557) and first["_flagi"] == ["zamieniono_lat_lon"]
    assert first["miasto"] == "Marki" and first["kod_pocztowy"] == "05-270" and first["adres"].startswith("Al.")
    # wiersz z poprawną kolejnością (współrzędne Krosna – błąd źródła) nie jest zamieniany
    assert not recs[6].get("_flagi") and recs[6]["lat"] == 49.718809346153336


def test_krosno_address_split_and_headers_trimmed():
    parsed, m, recs = records("krosno.csv")
    assert m["Numer Id"] == "aed_id" and m["Lokalizacja"] == "lokalizacja_w_obiekcie"
    assert recs[0]["adres"] == "ul. Jasna" and recs[0]["kod_pocztowy"] == "38-400" and recs[0]["miasto"] == "Krosno"
    assert (recs[0]["lat"], recs[0]["lon"]) == (49.718809346153336, 21.72034402175176) and not recs[0].get("_flagi")


def test_legionowo_address_composed_from_parts():
    _, m, recs = records("legionowo.csv")
    assert m["szerokosc_geograficzna"] == "lat" and m["miejscowosc"] == "miasto"
    r = recs[0]
    assert r["adres"] == "ul. Piłsudskiego 41" and r["miasto"] == "Legionowo" and r["kod_pocztowy"] == "05-120"
    assert r["lokalizacja_w_obiekcie"] == "Urząd Miasta Legionowo"


def test_przemysl_geojson_has_coordinates_and_csv_uses_geometry_column():
    parsed = ingest.parse_file("przemysl.geojson", (FIX / "przemysl.geojson").read_bytes())
    assert parsed["format"] == "json" and len(parsed["wiersze"]) == 21 and isinstance(parsed["wiersze"][0]["lat"], float)
    _, m, recs = records("przemysl.csv")
    assert "lat" not in m.values()  # w CSV współrzędne są tylko w kolumnie geometry
    assert (recs[0]["lat"], recs[0]["lon"]) == (49.7812096, 22.7750936)
    assert recs[0]["adres"] == "Juliusza Słowackiego 12" or recs[0]["adres"].endswith("12")
    assert recs[0]["miasto"] == "Przemyśl" and recs[0]["kod_pocztowy"] == "37-700"


def test_header_notes_mention_geometry_and_address():
    parsed = ingest.parse_file("przemysl.csv", (FIX / "przemysl.csv").read_bytes())
    prop = mapping.propose_mapping(parsed["naglowki"], SCHEMA)
    check = mapping.header_check(parsed["naglowki"], parsed["powtorzone"], prop, SCHEMA)
    assert "lat" not in check["brakujace"] and "lon" not in check["brakujace"]
    assert any("geometry" in n for n in check["uwagi"]) and any("Adres zostanie złożony" in n for n in check["uwagi"])
    assert "geometry" not in check["nadmiarowe"] and "home_number" not in check["nadmiarowe"]


def test_geojson_extension_is_accepted_and_pdf_still_rejected():
    assert ingest.detect_format("a.geojson") == "json"
    import pytest
    from app.errors import ApiError
    with pytest.raises(ApiError) as e:
        ingest.detect_format("a.pdf")
    assert e.value.status == 415
