"""Zgodność kodu z wzorcem XLSX (jedyne źródło prawdy)."""
import json
import sqlite3

import pytest
from openpyxl import load_workbook

from app.config import Config
from app.domain import rules
from app.domain.schema import field_names, load_schema

STATUSES = {"wymagane", "warunkowo_wymagane", "opcjonalne", "wyliczane"}
TYPES = {"tekst", "liczba", "data", "slownik", "tak_nie"}


@pytest.fixture(scope="module")
def schema():
    return load_schema(Config.STANDARD_XLSX)


def test_schema_matches_xlsx(schema):
    wb = load_workbook(Config.STANDARD_XLSX, read_only=True)
    xlsx_names = [r[0] for r in list(wb["Opis pól"].iter_rows(values_only=True))[1:] if r[0]]
    wb.close()
    assert field_names(schema) == xlsx_names
    assert len(set(xlsx_names)) == len(xlsx_names), "powtórzone nazwy pól"


def test_field_definitions_valid(schema):
    for p in schema["pola"] + schema["zrodlo_pola"]:
        assert p["status"] in STATUSES, p
        assert p["typ"] in TYPES, p
        assert p["etykieta"], p


def test_dictionary_fields_have_dictionaries(schema):
    for p in schema["pola"] + schema["zrodlo_pola"]:
        if p["typ"] == "slownik":
            assert schema["slowniki"].get(p["nazwa"]), f"brak słownika dla {p['nazwa']}"


def test_import_sheet_headers_match_schema(schema):
    wb = load_workbook(Config.STANDARD_XLSX, read_only=True)
    header = [c for c in next(wb["Dane"].iter_rows(values_only=True)) if c]
    wb.close()
    assert header == [p["nazwa"] for p in schema["pola"] if p["status"] != "wyliczane"]


def test_sample_sheet_rows_use_valid_dictionary_values(schema):
    wb = load_workbook(Config.STANDARD_XLSX, read_only=True)
    rows = list(wb["Przykładowe dane"].iter_rows(values_only=True))
    wb.close()
    header, data = rows[0], [r for r in rows[1:] if r and r[0]]
    for r in data:
        rec = dict(zip(header, r))
        for pole, allowed in schema["slowniki"].items():
            if pole in rec and rec[pole] not in (None, ""):
                assert rec[pole] in allowed, (pole, rec[pole])


def test_rules_reference_existing_fields(schema):
    names = set(field_names(schema))
    assert set(rules.CRITICAL_FIELDS) <= names
    assert set(rules.NONCRITICAL_REQUIRED_FIELDS) <= names


def test_rule_levels_and_issue_format():
    assert {lvl for lvl, _ in rules.RULES.values()} == {"blad", "ostrzezenie"}
    i = rules.issue("AED-COORD-001", pole="lat", aed_id="AED-0007")
    assert i == {"aed_id": "AED-0007", "pole": "lat", "regula": "AED-COORD-001", "poziom": "blad",
                 "komunikat": "Współrzędne nie są liczbami."}


def _insert(db_path):
    con = sqlite3.connect(db_path)
    con.execute("INSERT INTO aed (aed_id,payload_json,lat,lon) VALUES (?,?,?,?)",
                ("A1", json.dumps({"adres": "x", "miasto": "W"}), 52.2, 21.0))
    con.commit(); con.close()


def test_csv_header_and_json_keys_match_schema(client, schema, tmp_path):
    _insert(str(tmp_path / "t.db"))
    csv_header = client.get("/api/v1/export/aed.csv").get_data(as_text=True).lstrip("﻿").splitlines()[0]
    assert csv_header.split(";") == field_names(schema)
    item = client.get("/api/v1/export/aed.json").json["items"][0]
    assert list(item)[:len(field_names(schema))] == field_names(schema)


def test_meta_schema_endpoint_equals_loader(client, schema):
    body = client.get("/api/v1/meta/schema").json
    assert [p["nazwa"] for p in body["pola"]] == field_names(schema)
    assert body["slowniki"] == schema["slowniki"]
