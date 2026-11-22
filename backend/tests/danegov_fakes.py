"""Podmiana warstwy HTTP dane.gov.pl na zapisane PRAWDZIWE odpowiedzi portalu (tests/fixtures/danegov)."""
import urllib.parse
from pathlib import Path

from app.errors import ApiError
from app.services import danegov

FIX = Path(__file__).parent / "fixtures" / "danegov"
MEDIA = {"Defibrylator_jAmxQcp.csv": "krosno.csv", "Defibrylator_GminaMiastoMarki_1.csv": "marki.csv",
         "1730818801_b50R6UVxPgoVdBbq.geojson": "przemysl.geojson", "1730818801_b50R6UVxPgoVdBbq.csv": "przemysl.csv",
         "aed.csv": "legionowo.csv"}


def fake_fetch(url, accept=None, max_bytes=danegov.MAX_BYTES):
    danegov.check_url(url)
    p = urllib.parse.urlparse(url)
    if p.path == "/1.4/resources":
        q = urllib.parse.parse_qs(p.query)["q"][0].lower()
        return (FIX / ("search_aed.json" if q == "aed" else "search_defibrylator.json")).read_bytes()
    if p.path.startswith("/1.4/datasets/"):
        f = FIX / f"dataset_{p.path.rsplit('/', 1)[1]}.json"
        if not f.exists():
            raise ApiError(502, "UPSTREAM_ERROR", "Portal dane.gov.pl odpowiedział błędem 404.")
        return f.read_bytes()
    if p.path.startswith("/media/"):
        name = MEDIA.get(p.path.rsplit("/", 1)[1])
        if name:
            return (FIX / name).read_bytes()
    raise ApiError(502, "UPSTREAM_ERROR", f"Brak fixtury dla {url}")
