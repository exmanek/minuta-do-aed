from conftest import PASSWORD, REGON1, REGON3, login

B = "/api/v1"


def test_login_ok_and_me(client):
    h = login(client)
    me = client.get(f"{B}/provider/me", headers=h).json
    assert me["regon"] == REGON1 and me["status_weryfikacji"] == "zweryfikowany" and "haslo_hash" not in me


def test_login_errors(client):
    assert client.post(f"{B}/provider/login", json={"regon": "123456789", "haslo": "x"}).json["error"]["code"] == "INVALID_REGON"
    r = client.post(f"{B}/provider/login", json={"regon": REGON1, "haslo": "zle"})
    assert r.status_code == 401 and r.json["error"]["code"] == "INVALID_CREDENTIALS"
    r = client.post(f"{B}/provider/login", json={"regon": REGON3, "haslo": PASSWORD})
    assert r.status_code == 403 and r.json["error"]["code"] == "PROVIDER_NOT_VERIFIED"


def test_provider_endpoints_require_token(client):
    for path in ("/provider/me", "/provider/sources", "/provider/aed", "/provider/batches/b_x"):
        r = client.get(B + path)
        assert r.status_code == 401 and r.json["error"]["code"] == "AUTH_REQUIRED", path
    assert client.get(f"{B}/provider/me", headers={"Authorization": "Bearer zly"}).status_code == 401


def test_declarations_text(client):
    d = client.get(f"{B}/meta/oswiadczenie").json
    assert d["wersja"] == "v1" and d["robocza"] and len(d["oswiadczenia"]) == 3
