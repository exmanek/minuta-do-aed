import io
import ssl
import urllib.error
import urllib.request

import pytest

from app.errors import ApiError
from app.services import danegov
from conftest import COMMIT, login
from danegov_fakes import fake_fetch

B = "/api/v1"


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setattr(danegov, "fetch", fake_fetch)
    monkeypatch.setattr(danegov, "_sleep", lambda s: None)
    danegov.clear_cache()
    yield
    danegov.clear_cache()


# ---------------------------------------------------------------- katalog
def test_discover_finds_only_real_aed_datasets_and_picks_resources():
    items = {i["dataset_id"]: i for i in danegov.discover(refresh=True)["items"]}
    assert set(items) == {"3624", "4581", "4955", "39512", "40593"}  # „Otwarte dane ZTM” (rozmyte trafienie) odrzucone
    assert items["4581"]["zasob"]["format"] == "geojson" and items["4955"]["zasob"]["format"] == "csv"  # priorytet formatów
    assert items["40593"]["tytul"] == "Zdrowie" and items["40593"]["zasob"]["id"] == "2625221"  # znaleziony po zasobie, nie po tytule zbioru
    assert items["3624"]["wydawca"] == {"nazwa": "Urząd Miasta Krosna", "regon": "000526989", "miasto": "Krosno"}
    w = items["39512"]
    assert not w["mozna_importowac"] and w["zasob"] is None and "zewnętrznego wydawcy" in w["powod_pominiecia"]


def test_catalog_is_cached_until_refresh(monkeypatch):
    calls = []
    monkeypatch.setattr(danegov, "fetch", lambda url, *a, **k: calls.append(url) or fake_fetch(url))
    danegov.discover(); n = len(calls); danegov.discover()
    assert len(calls) == n
    danegov.discover(refresh=True)
    assert len(calls) == 2 * n


def test_source_meta_uses_publisher_as_dysponent_and_open_license():
    item = {i["dataset_id"]: i for i in danegov.discover()["items"]}["4955"]
    m = danegov.source_meta(item)
    assert m["nazwa"].startswith("dane.gov.pl #4955:") and m["licencja"] == "CC BY 4.0"
    assert m["prawo_do_udostepniania"] == "licencja_zrodla_pozwala" and m["dane_przykladowe"] is False
    assert m["dysponent_nazwa"] == "Urząd Miasta Marki" and m["dysponent_regon"] == "000526009"
    assert m["url"].startswith("https://dane.gov.pl/pl/dataset/4955,") and m["zakres_referencyjny"]["stan_na"] == "2025-07-10"
    assert "data_ostatniego_potwierdzenia" not in m  # data publikacji to nie potwierdzenie aktualności


# ---------------------------------------------------------------- warstwa HTTP (bez sieci)
def test_check_url_allows_only_portal_https_hosts():
    danegov.check_url("https://api.dane.gov.pl/media/x.csv")
    for bad in ("http://api.dane.gov.pl/x", "https://evil.example.com/x", "https://api.dane.gov.pl.evil.com/x",
                "https://dane.um.warszawa.pl/x", "https://api.dane.gov.pl:8443/x", "file:///etc/passwd"):
        with pytest.raises(ApiError) as e:
            danegov.check_url(bad)
        assert e.value.status == 502, bad


class _Resp:
    def __init__(self, body): self.body = io.BytesIO(body)
    def read(self, n=-1): return self.body.read(n)
    def __enter__(self): return self
    def __exit__(self, *a): return False


def _opener_returning(*seq):
    """seq: kolejne wyniki open(): bytes -> odpowiedź, wyjątek -> raise."""
    it = iter(seq)

    class O:
        def open(self, req, timeout=None):
            r = next(it)
            if isinstance(r, Exception):
                raise r
            return _Resp(r)
    return lambda: O()


def test_real_fetch_retries_then_succeeds_and_sends_neutral_user_agent(monkeypatch):
    import importlib
    seen = []
    err = urllib.error.HTTPError("u", 503, "x", {}, None)
    real = importlib.reload(danegov)  # przywraca prawdziwy fetch po podmianie w fixture
    monkeypatch.setattr(real, "_opener", _opener_returning(err, err, b"ok")); monkeypatch.setattr(real, "_sleep", lambda s: seen.append(s))
    assert real.fetch("https://api.dane.gov.pl/1.4/datasets") == b"ok" and seen == [0.5, 1.0]
    assert "MinutaDoAED" in real.USER_AGENT and "@" not in real.USER_AGENT


def test_real_fetch_error_mapping(monkeypatch):
    import importlib
    real = importlib.reload(danegov)
    monkeypatch.setattr(real, "_sleep", lambda s: None)
    cases = [([urllib.error.HTTPError("u", 404, "x", {}, None)], 502), ([urllib.error.HTTPError("u", 503, "x", {}, None)] * 3, 502),
             ([TimeoutError()] * 3, 504), ([urllib.error.URLError(TimeoutError())] * 3, 504),
             ([urllib.error.URLError(ssl.SSLError("bad cert"))], 502), ([b"x" * (real.MAX_BYTES + 1)], 502)]
    for seq, status in cases:
        monkeypatch.setattr(real, "_opener", _opener_returning(*seq))
        with pytest.raises(ApiError) as e:
            real.fetch("https://api.dane.gov.pl/x")
        assert e.value.status == status, seq


def test_redirect_guard_blocks_foreign_hosts():
    h = danegov._GuardRedirect()
    req = urllib.request.Request("https://api.dane.gov.pl/resources/1/file")
    with pytest.raises(ApiError):
        h.redirect_request(req, None, 302, "Found", {}, "https://evil.example.com/x.csv")
    assert h.redirect_request(req, None, 302, "Found", {}, "https://api.dane.gov.pl/media/resources/x.csv") is not None


# ---------------------------------------------------------------- endpointy
def test_endpoints_require_provider_token(client):
    assert client.get(f"{B}/provider/danegov/catalog").status_code == 401
    assert client.post(f"{B}/provider/danegov/import", json={"zbiory": ["3624"]}).status_code == 401


def test_catalog_endpoint(client, auth):
    d = client.get(f"{B}/provider/danegov/catalog?refresh=true", headers=auth).json
    assert len(d["items"]) == 5 and d["pobrano"] and sum(i["mozna_importowac"] for i in d["items"]) == 4


def test_import_validation_errors(client, auth):
    for body in (None, {}, {"zbiory": []}, {"zbiory": "3624"}, {"zbiory": list(range(11))}, {"zbiory": [{"a": 1}]}):
        assert client.post(f"{B}/provider/danegov/import", json=body, headers=auth).status_code == 400, body
    r = client.post(f"{B}/provider/danegov/import", json={"zbiory": ["39512", "999"]}, headers=auth)
    assert r.status_code == 422 and len(r.json["error"]["details"]) == 2  # Warszawa (zewnętrzny) i nieznany
    assert client.get(f"{B}/aed").json["liczba"] == 0


def test_upstream_failure_gives_502_or_504(client, auth, monkeypatch):
    def boom(status):
        def f(url, *a, **k): raise ApiError(status, "UPSTREAM_TIMEOUT" if status == 504 else "UPSTREAM_ERROR", "x")
        return f
    for status in (502, 504):
        danegov.clear_cache(); monkeypatch.setattr(danegov, "fetch", boom(status))
        r = client.get(f"{B}/provider/danegov/catalog?refresh=true", headers=auth)
        assert r.status_code == status and r.json["error"]["code"].startswith("UPSTREAM")


def _import(client, auth, ids):
    r = client.post(f"{B}/provider/danegov/import", json={"zbiory": ids}, headers=auth)
    assert r.status_code == 201, r.json
    return r.json


def _process(client, auth, batch):
    bid = batch["batch_id"]
    m = {z["zrodlo_id"]: {x["kolumna"]: x["pole"] for x in z["proponowane_mapowanie"]} for z in batch["zrodla"]}
    assert client.put(f"{B}/provider/batches/{bid}/mapping", json={"mapowanie": m}, headers=auth).status_code == 200
    p = client.post(f"{B}/provider/batches/{bid}/process", headers=auth)
    assert p.status_code == 200, p.json
    return bid, p.json


ALL = ["3624", "4581", "4955", "39512", "40593"]


def test_import_all_datasets_end_to_end(client, auth):
    batch = _import(client, auth, ALL)
    assert [p["dataset_id"] for p in batch["pominiete"]] == ["39512"] and "zewnętrznego" in batch["pominiete"][0]["powod"]
    counts = {z["nazwa"].split(":")[0]: z["liczba_wierszy"] for z in batch["zrodla"]}
    assert counts == {"dane.gov.pl #3624": 21, "dane.gov.pl #4581": 21, "dane.gov.pl #4955": 8, "dane.gov.pl #40593": 24}
    for z in batch["zrodla"]:
        assert z["licencja"] in ("CC0 1.0", "CC BY 4.0") and z["dane_przykladowe"] is False
        assert {"lat", "lon", "adres"}.isdisjoint(z["kontrola_naglowkow"]["brakujace"]), z["nazwa"]
    bid, proc = _process(client, auth, batch)
    s = proc["podsumowanie"]
    assert s["rekordy"] == 74 and s["z_bledami"] == 0 and proc["mozna_zatwierdzic"]
    rep = client.get(f"{B}/provider/batches/{bid}/report", headers=auth).json["problemy"]
    rules = {}
    for p in rep:
        rules.setdefault(p["regula"], []).append(p)
    assert len(rules["AED-COORD-003"]) == 7          # Marki: lat/lon odwrócone (7 z 8 wierszy)
    assert len(rules["AED-COORD-004"]) == 1          # Marki: punkt z Krosna, ~290 km od reszty
    assert len(rules["AED-AVAIL-002"]) == 74 and len(rules["AED-FRESH-001"]) == 74  # źródła nie mają dostępności/stanu/potwierdzenia
    assert "AED-LIC-001" not in rules and "AED-DICT-001" not in rules
    c = client.post(f"{B}/provider/batches/{bid}/commit", json=COMMIT, headers=auth)
    assert c.status_code == 200 and c.json["zatwierdzone"] == 74
    items = client.get(f"{B}/aed?limit=200").json["items"]
    assert len(items) == 74
    assert {i["status_dostepnosci"]["wartosc"] for i in items} == {"nieznany"}  # brak informacji ≠ niedostępny
    assert {i["znacznik_aktualnosci"] for i in items} == {"niepotwierdzone"}
    assert all(i["dane_przykladowe"] is False for i in items) and not any("[PRZYKŁADOWE]" in str(i) for i in items)
    krosno = [i for i in items if i["miasto"] == "Krosno"]
    assert len(krosno) == 21 and krosno[0]["dysponent_nazwa"] == "Urząd Miasta Krosna" and krosno[0]["lokalizacja_w_obiekcie"]
    meta = client.get(f"{B}/export/metadata.json").json
    assert not meta["title"].startswith("[PRZYKŁADOWE]")
    z = client.get(f"{B}/export/zrodla.csv").get_data(as_text=True)
    assert "CC BY 4.0" in z and "Urząd Miasta Marki" in z and "000526009" in z  # atrybucja i REGON wydawcy w eksporcie


def test_reimport_updates_records_instead_of_duplicating(client, auth):
    b1, _ = _process(client, auth, _import(client, auth, ["3624", "4581", "4955", "40593"]))[0], None
    client.post(f"{B}/provider/batches/{b1}/commit", json=COMMIT, headers=auth)
    before = {i["aed_id"] for i in client.get(f"{B}/aed?limit=200").json["items"]}
    bid2, proc = _process(client, auth, _import(client, auth, ["3624", "4581", "4955", "40593"]))
    assert proc["podsumowanie"]["zaktualizowane_istniejace"] == 74 and proc["podsumowanie"]["kandydaci_duplikatow"]["wzgledem_bazy"] == 0
    client.post(f"{B}/provider/batches/{bid2}/commit", json=COMMIT, headers=auth)
    assert {i["aed_id"] for i in client.get(f"{B}/aed?limit=200").json["items"]} == before


def test_one_unreadable_dataset_does_not_block_the_others(client, auth, monkeypatch):
    def flaky(url, *a, **k):
        if url.endswith("aed.csv"):
            return b"%PDF-1.4 to nie csv\x00\x01"
        return fake_fetch(url, *a, **k)
    monkeypatch.setattr(danegov, "fetch", flaky)
    batch = _import(client, auth, ["3624", "40593"])
    assert len(batch["zrodla"]) in (1, 2)  # plik binarny może zostać odczytany jako CSV, ale import całości nie pada
