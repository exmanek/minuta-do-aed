"""Pełny przepływ: źródło -> mapowanie -> przetwarzanie -> raport -> zatwierdzenie -> mapa/lista -> eksport."""
import csv
import io
import zipfile

from conftest import COMMIT, REGON2, login, to_processed, upload

B = "/api/v1"


def test_upload_rejects_pdf_and_bad_input(client, auth):
    r = client.post(f"{B}/provider/batches", data={"files": (io.BytesIO(b"%PDF"), "x.pdf")}, headers=auth,
                    content_type="multipart/form-data")
    assert r.status_code == 415 and r.json["error"]["code"] == "UNSUPPORTED_FORMAT"
    assert client.post(f"{B}/provider/batches", headers=auth).status_code == 400
    assert upload(client, auth, ["demo_a_wzorzec.csv"], metas=[{}, {}]).status_code == 400


def test_upload_proposes_mapping_and_header_check(client, auth):
    r = upload(client, auth, ["demo_b_cp1250.csv", "demo_c_osm.json"])
    assert r.status_code == 201 and r.json["status"] == "wczytana"
    b, c = r.json["zrodla"]
    assert b["kodowanie"] == "cp1250" and b["separator"] == ";"
    maps = {m["kolumna"]: m["pole"] for m in b["proponowane_mapowanie"]}
    assert maps["szer_geo"] == "lat" and maps["gdzie"] == "lokalizacja_w_obiekcie" and maps["godz"] == "godziny_dostepu"
    assert c["format"] == "json"
    assert {m["kolumna"]: m["pole"] for m in c["proponowane_mapowanie"]}["access"] == "ograniczenia_dostepu"


def test_process_before_mapping_is_conflict(client, auth):
    bid = upload(client, auth, ["demo_a_wzorzec.csv"]).json["batch_id"]
    r = client.post(f"{B}/provider/batches/{bid}/process", headers=auth)
    assert r.status_code == 409 and r.json["error"]["code"] == "STATE_CONFLICT"


def test_mapping_validation(client, auth):
    r = upload(client, auth, ["demo_a_wzorzec.csv"]).json
    bid, sid = r["batch_id"], r["zrodla"][0]["zrodlo_id"]
    bad = client.put(f"{B}/provider/batches/{bid}/mapping", json={"mapowanie": {sid: {"lat": "nie_ma_takiego"}}}, headers=auth)
    assert bad.status_code == 422 and bad.json["error"]["code"] == "INVALID_MAPPING"
    assert client.put(f"{B}/provider/batches/{bid}/mapping", json={"mapowanie": {}}, headers=auth).status_code == 422


def test_batch_ownership(client, auth):
    bid = upload(client, auth, ["demo_a_wzorzec.csv"]).json["batch_id"]
    other = login(client, REGON2)
    assert client.get(f"{B}/provider/batches/{bid}", headers=other).status_code == 403
    assert client.get(f"{B}/provider/batches/b_nie", headers=auth).status_code == 404


def test_full_flow_clean_source(client, auth):
    bid, proc = to_processed(client, auth, ["demo_a_wzorzec.csv"])
    s = proc["podsumowanie"]
    assert s["rekordy"] == 2 and s["z_bledami"] == 0 and proc["mozna_zatwierdzic"]
    assert client.get(f"{B}/aed").json["liczba"] == 0, "przed zatwierdzeniem nic nie jest publiczne"
    r = client.post(f"{B}/provider/batches/{bid}/commit", json={**COMMIT, "oswiadczenie_prawa_do_udostepniania": False}, headers=auth)
    assert r.status_code == 422 and r.json["error"]["code"] == "DECLARATION_REQUIRED"
    c = client.post(f"{B}/provider/batches/{bid}/commit", json=COMMIT, headers=auth)
    assert c.status_code == 200 and c.json["zatwierdzone"] == 2
    assert c.json["publikacja_dane_gov_pl"] == "nie_opublikowano_przez_prototyp"
    items = client.get(f"{B}/aed?lat=52.2297&lon=21.0122").json["items"]
    assert len(items) == 2 and items[0]["odleglosc_m"] <= items[1]["odleglosc_m"]
    it = items[0]
    assert it["dane_przykladowe"] is True and it["data_importu"] and it["liczba_zrodel"] == 1
    nodate = [i for i in items if not i["data_ostatniego_potwierdzenia"]]
    assert nodate and nodate[0]["znacznik_aktualnosci"] == "niepotwierdzone"
    detail = client.get(f"{B}/aed/{it['aed_id']}").json
    assert detail["zrodla_skladowe"][0]["licencja"] == "CC BY 4.0" and detail["zrodla_skladowe"][0]["glowne"]
    assert client.post(f"{B}/provider/batches/{bid}/commit", json=COMMIT, headers=auth).status_code == 409


def test_blocking_errors_and_reject_option(client, auth):
    bid, proc = to_processed(client, auth, ["demo_b_cp1250.csv", "demo_e_xlsx.xlsx"])
    assert proc["podsumowanie"]["z_bledami"] >= 3 and not proc["mozna_zatwierdzic"]
    r = client.post(f"{B}/provider/batches/{bid}/commit", json={**COMMIT, "odrzuc_bledne": False}, headers=auth)
    assert r.status_code == 422 and r.json["error"]["code"] == "VALIDATION_BLOCKING"
    codes = {d["regula"] for d in r.json["error"]["details"]}
    assert {"AED-REQ-001", "AED-DICT-001", "AED-DATE-002"} <= codes
    rep = client.get(f"{B}/provider/batches/{bid}/report?poziom=blad", headers=auth).json
    assert rep["problemy"] and all(p["poziom"] == "blad" for p in rep["problemy"])
    csv_rep = client.get(f"{B}/provider/batches/{bid}/report?format=csv", headers=auth).get_data(as_text=True)
    assert "regula" in csv_rep.splitlines()[0]
    ok = client.post(f"{B}/provider/batches/{bid}/commit", json=COMMIT, headers=auth)
    assert ok.status_code == 200 and ok.json["odrzucone"] >= 3 and ok.json["zatwierdzone"] >= 1


def test_source_without_license_blocks_everything(client, auth):
    metas = [{"nazwa": "bez-licencji", "zakres_referencyjny": "x", "dysponent_nazwa": "d", "prawo_do_udostepniania": "nieustalone"}]
    bid, proc = to_processed(client, auth, ["demo_a_wzorzec.csv"], metas)
    assert proc["podsumowanie"]["z_bledami"] == 2
    r = client.post(f"{B}/provider/batches/{bid}/commit", json={**COMMIT, "odrzuc_bledne": False}, headers=auth)
    assert "AED-LIC-001" in {d["regula"] for d in r.json["error"]["details"]}


def test_explicit_confirmation_sets_date(client, auth):
    bid, _ = to_processed(client, auth, ["demo_a_wzorzec.csv"])
    client.post(f"{B}/provider/batches/{bid}/commit", json={**COMMIT, "potwierdzam_aktualnosc": True}, headers=auth)
    assert {i["znacznik_aktualnosci"] for i in client.get(f"{B}/aed").json["items"]} == {"aktualne"}


def test_duplicates_never_auto_merged(client, auth):
    bid, proc = to_processed(client, auth, ["demo_a_wzorzec.csv", "demo_d_duplikaty.csv"])
    assert proc["podsumowanie"]["kandydaci_duplikatow"]["w_partii"] == 1
    cands = client.get(f"{B}/provider/batches/{bid}/duplicates", headers=auth).json["items"]
    assert len(cands) == 1 and cands[0]["pewnosc"] == "prawdopodobny" and cands[0]["wlasny_rekord_b"]
    rep = client.get(f"{B}/provider/batches/{bid}/report", headers=auth).json["problemy"]
    assert "AED-DUP-001" in {p["regula"] for p in rep}
    c = client.post(f"{B}/provider/batches/{bid}/commit", json=COMMIT, headers=auth).json
    # 2 + 2 rekordy z pliku D, minus 1 poza Polską? (poza Polską to tylko ostrzeżenie) -> 4 rekordy, nic nie scalone
    assert c["scalone"] == 0 and client.get(f"{B}/aed").json["liczba"] == 4


def test_duplicate_merge_keeps_all_sources(client, auth):
    bid, _ = to_processed(client, auth, ["demo_a_wzorzec.csv", "demo_d_duplikaty.csv"])
    c = client.get(f"{B}/provider/batches/{bid}/duplicates", headers=auth).json["items"][0]
    r = client.post(f"{B}/provider/batches/{bid}/duplicates/decisions", headers=auth,
                    json={"decyzje": [{"aed_a": c["aed_a"], "aed_b": c["aed_b"], "decyzja": "scal"}]})
    assert r.status_code == 200
    out = client.post(f"{B}/provider/batches/{bid}/commit", json=COMMIT, headers=auth).json
    assert out["scalone"] == 1
    merged = [i for i in client.get(f"{B}/aed").json["items"] if i["liczba_zrodel"] == 2]
    assert len(merged) == 1
    d = client.get(f"{B}/aed/{merged[0]['aed_id']}").json
    assert len(d["zrodla_skladowe"]) == 2 and sum(s["glowne"] for s in d["zrodla_skladowe"]) == 1
    assert d["konflikty"]
    h = client.get(f"{B}/provider/aed/{merged[0]['aed_id']}/history", headers=auth).json
    assert {"utworzenie", "scalenie"} <= {x["typ_zmiany"] for x in h["historia"]} and h["deklaracje"]


def test_merge_foreign_record_blocked(client, auth):
    bid, _ = to_processed(client, auth, ["demo_a_wzorzec.csv"])
    client.post(f"{B}/provider/batches/{bid}/commit", json=COMMIT, headers=auth)
    other = login(client, REGON2)
    bid2, proc = to_processed(client, other, ["demo_d_duplikaty.csv"])
    assert proc["podsumowanie"]["kandydaci_duplikatow"]["wzgledem_bazy"] == 1
    cand = client.get(f"{B}/provider/batches/{bid2}/duplicates", headers=other).json["items"][0]
    assert not cand["wlasny_rekord_b"]
    r = client.post(f"{B}/provider/batches/{bid2}/duplicates/decisions", headers=other,
                    json={"decyzje": [{"aed_a": cand["aed_a"], "aed_b": cand["aed_b"], "decyzja": "scal"}]})
    assert r.status_code == 422 and r.json["error"]["code"] == "MERGE_FOREIGN_RECORD"


def test_reimport_updates_same_record_and_keeps_confirmation(client, auth):
    bid, _ = to_processed(client, auth, ["demo_a_wzorzec.csv"])
    client.post(f"{B}/provider/batches/{bid}/commit", json={**COMMIT, "potwierdzam_aktualnosc": True}, headers=auth)
    before = client.get(f"{B}/aed").json["items"]
    bid2, proc = to_processed(client, auth, ["demo_a_wzorzec.csv"])
    assert proc["podsumowanie"]["zaktualizowane_istniejace"] == 2
    assert proc["podsumowanie"]["kandydaci_duplikatow"]["wzgledem_bazy"] == 0
    client.post(f"{B}/provider/batches/{bid2}/commit", json=COMMIT, headers=auth)
    after = client.get(f"{B}/aed").json["items"]
    assert len(after) == 2 and {i["aed_id"] for i in after} == {i["aed_id"] for i in before}
    assert {i["data_ostatniego_potwierdzenia"] for i in after} == {i["data_ostatniego_potwierdzenia"] for i in before}


def test_exports_after_commit(client, auth):
    bid, _ = to_processed(client, auth, ["demo_a_wzorzec.csv"])
    assert client.get(f"{B}/provider/batches/{bid}/export", headers=auth).status_code == 409
    client.post(f"{B}/provider/batches/{bid}/commit", json=COMMIT, headers=auth)
    r = client.get(f"{B}/export/aed.csv")
    assert "aed_przykladowe.csv" in r.headers["Content-Disposition"]
    rows = list(csv.reader(io.StringIO(r.get_data(as_text=True).lstrip("﻿")), delimiter=";"))
    assert len(rows) == 3
    assert len(client.get(f"{B}/export/aed.geojson").json["features"]) == 2
    assert client.get(f"{B}/export/aed.json").json["items"][0]["zrodla_skladowe"]
    assert "licencja" in client.get(f"{B}/export/zrodla.csv").get_data(as_text=True)
    assert "glowne" in client.get(f"{B}/export/aed_zrodla.csv").get_data(as_text=True)
    meta = client.get(f"{B}/export/metadata.json").json
    assert meta["title"].startswith("[PRZYKŁADOWE]") and len(meta["resources"]) == 5
    assert client.get(f"{B}/export/metadata.xml").get_data(as_text=True).startswith("<?xml")
    z = client.get(f"{B}/provider/batches/{bid}/export?format=zip", headers=auth)
    assert z.status_code == 200 and "aed_przykladowe.csv" in zipfile.ZipFile(io.BytesIO(z.data)).namelist()
    assert client.get(f"{B}/provider/batches/{bid}", headers=auth).json["eksport_wygenerowano"]


def test_import_formats_json_xlsx_csv_all_work(client, auth):
    for f in ("demo_c_osm.json", "demo_e_xlsx.xlsx", "demo_a_wzorzec.csv"):
        _, proc = to_processed(client, auth, [f])
        assert proc["podsumowanie"]["rekordy"] >= 2, f


def test_template_download(client):
    r = client.get(f"{B}/standard/template.xlsx")
    assert r.status_code == 200 and r.data[:2] == b"PK"
