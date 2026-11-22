from pathlib import Path

import pytest

from app import create_app
from app.auth import hash_password
from app.services.regon import make_regon9
from app.storage import repo
from app.storage.db import get_db

PASSWORD = "test-haslo"
SAMPLES = Path(__file__).resolve().parent.parent / "data" / "sample_sources"
REGON1, REGON2, REGON3 = "123456785", make_regon9("22222222"), make_regon9("33333333")


@pytest.fixture
def app(tmp_path):
    app = create_app({"TESTING": True, "DB_PATH": str(tmp_path / "t.db"), "FRONTEND_DIST": str(tmp_path / "nodist")})
    with app.app_context(), get_db():
        for regon, nazwa, status in ((REGON1, "Dostawca 1", "zweryfikowany"), (REGON2, "Dostawca 2", "zweryfikowany"),
                                     (REGON3, "Dostawca 3", "zalozony")):
            repo.create_provider(regon, nazwa, hash_password(PASSWORD), status)
    return app


@pytest.fixture
def client(app):
    return app.test_client()


def login(client, regon=REGON1):
    r = client.post("/api/v1/provider/login", json={"regon": regon, "haslo": PASSWORD})
    assert r.status_code == 200, r.json
    return {"Authorization": f"Bearer {r.json['token']}"}


@pytest.fixture
def auth(client):
    return login(client)


GOOD_SOURCE = {"licencja": "CC BY 4.0", "prawo_do_udostepniania": "dane_wlasne", "dysponent_nazwa": "Dysponent Testowy",
               "zakres_referencyjny": "Warszawa, test", "dane_przykladowe": True}


def upload(client, auth, files, metas=None):
    """files: lista nazw plików z data/sample_sources."""
    import io
    import json
    data = {"files": [(io.BytesIO((SAMPLES / f).read_bytes()), f) for f in files],
            "meta": json.dumps(metas or [{**GOOD_SOURCE, "nazwa": f} for f in files])}
    return client.post("/api/v1/provider/batches", data=data, headers=auth, content_type="multipart/form-data")


def to_processed(client, auth, files, metas=None):
    r = upload(client, auth, files, metas)
    assert r.status_code == 201, r.json
    bid = r.json["batch_id"]
    mapping = {z["zrodlo_id"]: {m["kolumna"]: m["pole"] for m in z["proponowane_mapowanie"]} for z in r.json["zrodla"]}
    assert client.put(f"/api/v1/provider/batches/{bid}/mapping", json={"mapowanie": mapping}, headers=auth).status_code == 200
    p = client.post(f"/api/v1/provider/batches/{bid}/process", headers=auth)
    assert p.status_code == 200, p.json
    return bid, p.json


COMMIT = {"oswiadczenie_prawdziwosci": True, "oswiadczenie_prawa_do_udostepniania": True, "wersja_tresci": "v1",
          "potwierdzam_aktualnosc": False, "odrzuc_bledne": True}
