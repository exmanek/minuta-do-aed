import json
import sqlite3

from conftest import REGON2, login

B = "/api/v1"
FORM = {"lat": 52.23, "lon": 21.01, "adres": "ul. Formularzowa 1", "miasto": "Warszawa", "lokalizacja_w_obiekcie": "Hol",
        "dostepnosc": "calodobowo", "bariera_dostepu": "brak", "ograniczenia_dostepu": "publiczny", "stan": "sprawny",
        "oswiadczenie_prawdziwosci": True, "oswiadczenie_prawa_do_udostepniania": True, "wersja_tresci": "v1"}


def _create(client, auth, **kw):
    return client.post(f"{B}/provider/aed", json={**FORM, **kw}, headers=auth)


def test_live_validation_does_not_save(client, auth):
    r = client.post(f"{B}/provider/aed/validate", json={"lat": "abc"}, headers=auth).json
    assert not r["mozna_zapisac"] and "AED-COORD-001" in {p["regula"] for p in r["problemy"]}
    assert client.get(f"{B}/aed").json["liczba"] == 0


def test_create_update_withdraw_history(client, auth):
    assert _create(client, auth, oswiadczenie_prawdziwosci=False).json["error"]["code"] == "DECLARATION_REQUIRED"
    assert _create(client, auth, lat=None).json["error"]["code"] == "VALIDATION_BLOCKING"
    r = _create(client, auth)
    assert r.status_code == 201
    aid = r.json["aed_id"]
    assert r.json["znacznik_aktualnosci"] == "niepotwierdzone" and r.json["status_dostepnosci"]["wartosc"] == "dostepny"
    assert _create(client, auth, aed_id=aid).status_code == 409
    up = client.put(f"{B}/provider/aed/{aid}", json={**FORM, "stan": "czasowo_niedostepny", "potwierdzam_aktualnosc": True}, headers=auth)
    assert up.status_code == 200 and up.json["znacznik_aktualnosci"] == "aktualne"
    assert up.json["status_dostepnosci"]["wartosc"] == "niedostepny"
    types = [h["typ_zmiany"] for h in client.get(f"{B}/provider/aed/{aid}/history", headers=auth).json["historia"]]
    assert types == ["potwierdzenie", "edycja", "utworzenie"]
    assert client.delete(f"{B}/provider/aed/{aid}", headers=auth).json["status"] == "wycofany"
    assert client.get(f"{B}/aed/{aid}").status_code == 404 and client.get(f"{B}/aed").json["liczba"] == 0
    assert client.get(f"{B}/export/aed.csv").get_data(as_text=True).count("\n") == 1  # tylko nagłówek
    assert len(client.get(f"{B}/provider/aed/{aid}/history", headers=auth).json["historia"]) == 4


def test_other_provider_cannot_touch_record(client, auth):
    aid = _create(client, auth).json["aed_id"]
    other = login(client, REGON2)
    for call in (lambda: client.put(f"{B}/provider/aed/{aid}", json=FORM, headers=other),
                 lambda: client.delete(f"{B}/provider/aed/{aid}", headers=other),
                 lambda: client.get(f"{B}/provider/aed/{aid}/history", headers=other)):
        assert call().status_code == 403
    assert client.put(f"{B}/provider/aed/AED-NIE", json=FORM, headers=auth).status_code == 404


def test_reports_do_not_modify_aed_or_export(client, auth, app, tmp_path):
    aid = _create(client, auth).json["aed_id"]
    db = str(tmp_path / "t.db")
    snap = lambda: sqlite3.connect(db).execute("SELECT * FROM aed").fetchall()
    before, csv_before = snap(), client.get(f"{B}/export/aed.csv").data
    status_before = client.get(f"{B}/aed/{aid}").json["status_dostepnosci"]["wartosc"]
    for _ in range(2):
        assert client.post(f"{B}/aed/{aid}/reports", json={"typ": "zamkniete_na_klucz", "komentarz": "Szafka zamknięta"}).status_code == 201
    assert snap() == before and client.get(f"{B}/export/aed.csv").data == csv_before
    d = client.get(f"{B}/aed/{aid}").json
    assert d["status_dostepnosci"]["wartosc"] == status_before and d["znacznik_aktualnosci"] == "niepotwierdzone"
    assert d["sygnaly"]["ostrzezenie_dostepu"] is True and d["sygnaly"]["zamkniete_na_klucz"] == 2
    assert len(client.get(f"{B}/aed/{aid}/reports").json["items"]) == 2


def test_reports_validation_and_rate_limit(client, auth):
    aid = _create(client, auth).json["aed_id"]
    assert client.post(f"{B}/aed/AED-NIE/reports", json={"typ": "uszkodzone"}).status_code == 404
    assert client.post(f"{B}/aed/{aid}/reports", json={"typ": "xx"}).status_code == 422
    assert client.post(f"{B}/aed/{aid}/reports", json={"typ": "uszkodzone", "komentarz": "x" * 301}).status_code == 422
    codes = [client.post(f"{B}/aed/{aid}/reports", json={"typ": "uszkodzone"}).status_code for _ in range(6)]
    assert codes == [201] * 5 + [429]


def _seed(app_db, rows):
    con = sqlite3.connect(app_db)
    for aid, lat, lon, payload, pot in rows:
        con.execute("INSERT INTO aed (aed_id,payload_json,lat,lon,regon_dostawcy,data_ostatniego_potwierdzenia) VALUES (?,?,?,?,?,?)",
                    (aid, json.dumps(payload), lat, lon, "123456785", pot))
    con.commit()


def test_list_filters(client, tmp_path):
    ok = {"dostepnosc": "calodobowo", "bariera_dostepu": "brak", "ograniczenia_dostepu": "publiczny", "stan": "sprawny"}
    _seed(str(tmp_path / "t.db"), [("A", 52.2, 21.0, ok, "2026-11-01"),
                                   ("B", 52.21, 21.0, {**ok, "stan": "czasowo_niedostepny"}, "2020-01-01"),
                                   ("C", 52.22, 21.0, {**ok, "bariera_dostepu": "klucz"}, None),
                                   ("D", 52.23, 21.0, {**ok, "stan": "nieznany"}, None)])
    ids = lambda q: [i["aed_id"] for i in client.get(f"{B}/aed?{q}").json["items"]]
    assert ids("") == ["A", "B", "C", "D"]
    assert ids("dostepnosc_teraz=true") == ["A", "C", "D"], "nieznany zostaje, pomijamy tylko niedostepny"
    assert ids("status_dostepnosci=ograniczony_dostep,nieznany") == ["C", "D"]
    assert ids("tylko_aktualne=true") == ["A"]
    assert ids("lat=52.2&lon=21.0&radius_m=1500&sort=odleglosc") == ["A", "B"]
    assert ids("bbox=20.9,52.205,21.1,52.225") == ["B", "C"]
    assert ids("limit=2&offset=1") == ["B", "C"]
    for bad in ("sort=odleglosc", "status_dostepnosci=zly", "bbox=1,2", "limit=x", "lat=1"):
        assert client.get(f"{B}/aed?{bad}").status_code == 400, bad
