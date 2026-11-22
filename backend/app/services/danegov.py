"""Pobieranie danych o AED z portalu dane.gov.pl (publiczne API 1.4, bez klucza).

Zasady: weryfikacja TLS zawsze włączona (paczka CA z `certifi`), pobieranie wyłącznie z hostów portalu
(także po przekierowaniach), limit rozmiaru, timeouty, ponowienia na 429/5xx, neutralny User-Agent.
Wyszukiwanie dzieje się na poziomie ZASOBÓW (wyszukiwarka zbiorów jest rozmyta i gubi np. zbiór o tytule „Zdrowie”).
"""
import json
import os
import re
import socket
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import PurePosixPath

from ..errors import ApiError

API = "https://api.dane.gov.pl"
PORTAL = "https://dane.gov.pl"
ALLOWED_HOSTS = {"api.dane.gov.pl", "dane.gov.pl", "www.dane.gov.pl"}
USER_AGENT = "MinutaDoAED/0.1 (prototyp hackathonowy; otwarte dane)"
JSONAPI = "application/vnd.api+json"
MAX_BYTES = 10 * 1024 * 1024
TIMEOUT = 25
RETRIES = 2
CACHE_TTL = 600
QUERIES = ("defibrylator", "defibrylatory", "defibryzator", "AED")
PAGES = 2
PATTERN = re.compile(r"defibr|defibryz|\bAED\b", re.I)
FORMAT_PRIORITY = {"geojson": 0, "csv": 1, "xlsx": 2, "json": 3}  # xml/gml pomijamy
_cache = {"t": 0.0, "data": None}


def _clean(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()


def check_url(url):
    """Dozwolone tylko https i hosty portalu (ochrona przed SSRF, także dla przekierowań)."""
    p = urllib.parse.urlparse(url)
    if p.scheme != "https" or p.hostname not in ALLOWED_HOSTS or p.port not in (None, 443):
        raise ApiError(502, "UPSTREAM_ERROR", f"Niedozwolony adres źródła: {p.hostname or url}.")
    return url


class _GuardRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _opener():
    cafile = os.environ.get("SSL_CERT_FILE")
    if not cafile:
        try:
            import certifi  # paczka CA; Python z python.org na macOS nie ma własnej
            cafile = certifi.where()
        except ImportError:
            raise ApiError(502, "UPSTREAM_ERROR", "Brak pakietu certifi – uruchom: pip install -r requirements.txt")
    ctx = ssl.create_default_context(cafile=cafile)
    return urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx), _GuardRedirect)


def _sleep(s):  # osobna funkcja: testy ją podmieniają
    time.sleep(s)


def fetch(url, accept=None, max_bytes=MAX_BYTES):
    """GET z limitem rozmiaru i ponowieniami. Błędy -> ApiError 502/504."""
    check_url(url)
    headers = {"User-Agent": USER_AGENT, **({"Accept": accept} if accept else {})}
    last = None
    for attempt in range(RETRIES + 1):
        try:
            with _opener().open(urllib.request.Request(url, headers=headers), timeout=TIMEOUT) as r:
                body = r.read(max_bytes + 1)
            if len(body) > max_bytes:
                raise ApiError(502, "UPSTREAM_ERROR", f"Plik ze źródła jest większy niż {max_bytes // 1024 // 1024} MB.")
            return body
        except ApiError:
            raise
        except urllib.error.HTTPError as e:
            last = e
            if e.code not in (429, 500, 502, 503, 504):
                raise ApiError(502, "UPSTREAM_ERROR", f"Portal dane.gov.pl odpowiedział błędem {e.code}.")
        except (socket.timeout, TimeoutError) as e:
            last = e
        except urllib.error.URLError as e:
            last = e
            if isinstance(e.reason, (socket.timeout, TimeoutError)):
                continue
            if isinstance(e.reason, ssl.SSLError):
                raise ApiError(502, "UPSTREAM_ERROR", "Nie udało się zweryfikować certyfikatu portalu dane.gov.pl.")
        if attempt < RETRIES:
            _sleep(0.5 * 2 ** attempt)
    if isinstance(last, (socket.timeout, TimeoutError)) or isinstance(getattr(last, "reason", None), (socket.timeout, TimeoutError)):
        raise ApiError(504, "UPSTREAM_TIMEOUT", "Portal dane.gov.pl nie odpowiedział w wyznaczonym czasie.")
    raise ApiError(502, "UPSTREAM_ERROR", "Portal dane.gov.pl jest chwilowo niedostępny.")


def _json(url):
    try:
        return json.loads(fetch(url, JSONAPI).decode("utf-8"))
    except ValueError:
        raise ApiError(502, "UPSTREAM_ERROR", "Portal dane.gov.pl zwrócił niepoprawną odpowiedź.")


def _hosted(file_url):
    """Plik hostowany przez portal (a nie link do strony zewnętrznego wydawcy)."""
    p = urllib.parse.urlparse(file_url or "")
    return p.scheme == "https" and p.hostname in ALLOWED_HOSTS and p.path.startswith("/media/")


def _search_resources():
    jobs = [(q, page) for q in QUERIES for page in range(1, PAGES + 1)]

    def one(job):
        q, page = job
        return _json(f"{API}/1.4/resources?" + urllib.parse.urlencode({"q": q, "per_page": 100, "page": page}))

    found = {}  # dataset_id -> {resource_id: resource}
    with ThreadPoolExecutor(max_workers=4) as ex:
        for res in ex.map(one, jobs):
            for r in res.get("data", []):
                if PATTERN.search(_clean(r["attributes"].get("title"))):
                    ds = r["relationships"]["dataset"]["data"]["id"]
                    found.setdefault(ds, {})[r["id"]] = r
    return found


def _dataset_item(dsid, resources):
    d = _json(f"{API}/1.4/datasets/{dsid}?include=resources,institution")
    a = d["data"]["attributes"]
    inc = d.get("included", [])
    inst = next((i["attributes"] for i in inc if i["type"] == "institution"), {})
    detail = {i["id"]: i["attributes"] for i in inc if i["type"] == "resource"}
    cands = []
    for rid, r in resources.items():
        ra = {**r["attributes"], **detail.get(rid, {})}
        cands.append({"id": rid, "tytul": _clean(ra.get("title")), "format": (ra.get("format") or "").lower(),
                      "url": ra.get("file_url"), "rozmiar": ra.get("file_size"), "data": ra.get("data_date")})
    ok = sorted((c for c in cands if c["format"] in FORMAT_PRIORITY and _hosted(c["url"])),
                key=lambda c: (FORMAT_PRIORITY[c["format"]], c["data"] and -int(c["data"].replace("-", "")) or 0))
    reason = None
    if not ok:
        if any(c["format"] in FORMAT_PRIORITY and not _hosted(c["url"]) for c in cands):
            reason = "Zasób jest linkiem do strony zewnętrznego wydawcy, a nie plikiem hostowanym przez portal – nie można go pobrać."
        else:
            reason = "Brak obsługiwanego formatu pliku (CSV, GeoJSON, XLSX, JSON)."
    slug = a.get("slug") or ""
    return {
        "dataset_id": dsid, "tytul": _clean(a.get("title")), "strona_url": f"{PORTAL}/pl/dataset/{dsid},{slug}".rstrip(","),
        "wydawca": {"nazwa": inst.get("title"), "regon": inst.get("regon"), "miasto": inst.get("city")},
        "licencja": a.get("license_name"), "aktualizacja": a.get("update_frequency"),
        "zasob": ok[0] if ok else None, "inne_formaty": sorted({c["format"] for c in cands}),
        "mozna_importowac": bool(ok), "powod_pominiecia": reason,
    }


def discover(refresh=False):
    """Katalog zbiorów AED z portalu (cache w pamięci, TTL 10 min)."""
    if not refresh and _cache["data"] and time.time() - _cache["t"] < CACHE_TTL:
        return _cache["data"]
    found = _search_resources()
    ids = sorted(found, key=int)
    with ThreadPoolExecutor(max_workers=4) as ex:
        items = list(ex.map(lambda i: _dataset_item(i, found[i]), ids))
    data = {"items": items, "pobrano": datetime.now().astimezone().isoformat(timespec="seconds"), "zrodlo": f"{API}/1.4"}
    _cache.update(t=time.time(), data=data)
    return data


def clear_cache():
    _cache.update(t=0.0, data=None)


def download(item):
    """-> (nazwa_pliku, bytes) dla wybranego zasobu zbioru."""
    z = item["zasob"]
    name = PurePosixPath(urllib.parse.urlparse(z["url"]).path).name
    if PurePosixPath(name).suffix.lower() not in (".csv", ".json", ".geojson", ".xlsx"):
        name = f"zasob_{z['id']}.{'geojson' if z['format'] == 'geojson' else z['format']}"
    return name, fetch(z["url"])


def source_meta(item):
    """Opis źródła dla pipeline.create_batch. Wydawca z portalu = dysponent; licencja z portalu; data_date to stan_na, nie potwierdzenie."""
    w, z = item["wydawca"], item["zasob"]
    lic = item["licencja"]
    return {
        # id zbioru w nazwie = stały klucz źródła (ponowny import aktualizuje te same rekordy)
        "nazwa": f"dane.gov.pl #{item['dataset_id']}: {item['tytul']}"[:120], "url": item["strona_url"], "licencja": lic,
        "prawo_do_udostepniania": "licencja_zrodla_pozwala",
        "podstawa_prawa_opis": f"Zbiór opublikowany na portalu dane.gov.pl przez {w['nazwa']} na licencji {lic}. Wymagana atrybucja zgodnie z licencją.",
        "dysponent_nazwa": w["nazwa"], "dysponent_regon": w["regon"], "dane_przykladowe": False,
        "zakres_referencyjny": {"opis": f"Lokalizacje AED udostępnione przez {w['nazwa']} (zbiór „{item['tytul']}”, dane.gov.pl)",
                                "obszar": {"nazwa": w.get("miasto")}, "stan_na": z.get("data")},
    }
