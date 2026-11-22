import json
import sqlite3

from app.domain.schema import field_names, load_schema
from app.services.regon import is_valid_regon_format

CFG = "/api/v1"


def test_health(client):
    r = client.get(f"{CFG}/health")
    assert r.status_code == 200 and r.json["status"] == "ok"


def test_schema_from_xlsx(client):
    r = client.get(f"{CFG}/meta/schema")
    assert r.status_code == 200
    names = [p["nazwa"] for p in r.json["pola"]]
    assert "lat" in names and "lokalizacja_w_obiekcie" in names
    assert r.json["zrodlo_pola"] and r.json["pola_wyliczane"]
    assert "calodobowo" in r.json["slowniki"]["dostepnosc"]


def test_error_format_404(client):
    r = client.get(f"{CFG}/aed/NIE-MA")
    assert r.status_code == 404
    assert set(r.json["error"]) == {"code", "message", "details"}
    assert r.json["error"]["code"] == "NOT_FOUND"


def test_unknown_api_path_is_json(client):
    assert client.get(f"{CFG}/nic").json["error"]["code"] == "NOT_FOUND"


def test_aed_list_empty_and_bad_params(client):
    r = client.get(f"{CFG}/aed")
    assert r.status_code == 200 and r.json["items"] == [] and r.json["liczba"] == 0
    assert client.get(f"{CFG}/aed?lat=52").status_code == 400


def _insert(app_db, aed_id="A1"):
    con = sqlite3.connect(app_db)
    con.execute("INSERT INTO aed (aed_id,payload_json,lat,lon) VALUES (?,?,?,?)",
                (aed_id, json.dumps({"adres": "x", "miasto": "W"}), 52.2286, 21.0035))
    con.commit(); con.close()


def test_aed_roundtrip_and_export(client, tmp_path):
    _insert(str(tmp_path / "t.db"))
    r = client.get(f"{CFG}/aed?lat=52.2297&lon=21.0122&radius_m=2000")
    assert r.json["liczba"] == 1 and r.json["items"][0]["odleglosc_m"] > 0
    assert r.json["items"][0]["znacznik_aktualnosci"] == "niepotwierdzone"
    assert client.get(f"{CFG}/aed/A1").json["aed_id"] == "A1"
    csv_text = client.get(f"{CFG}/export/aed.csv").get_data(as_text=True)
    schema = load_schema(client.application.config["STANDARD_XLSX"])
    assert csv_text.lstrip("﻿").splitlines()[0].split(";") == field_names(schema)
    assert client.get(f"{CFG}/export/aed.json").json["liczba"] == 1


def test_regon():
    assert is_valid_regon_format("123456785")
    assert not is_valid_regon_format("123456789")
    assert not is_valid_regon_format("abc")


def test_login_validation_and_stub(client):
    assert client.post(f"{CFG}/provider/login", json={"regon": "123456789", "haslo": "x"}).json["error"]["code"] == "INVALID_REGON"
    assert client.post(f"{CFG}/provider/login", json={"regon": "123456785", "haslo": "x"}).status_code == 501
    assert client.post(f"{CFG}/provider/login", data="zle").status_code == 400
