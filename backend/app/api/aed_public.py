import hashlib
import time
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request

from ..errors import ApiError
from ..services.availability import compute_status
from ..services.freshness import znacznik_aktualnosci
from ..services.geo import haversine_m
from ..storage import repo
from ..storage.db import get_db

bp = Blueprint("aed_public", __name__)
STATUSES = {"dostepny", "ograniczony_dostep", "niedostepny", "nieznany"}
REPORT_TYPES = {"zamkniete_na_klucz", "potwierdzam_obecnosc", "brak_urzadzenia", "uszkodzone"}


def _bool(name):
    return request.args.get(name, "").lower() in ("true", "1", "tak")


def _num(name, cast=float):
    v = request.args.get(name)
    if v is None:
        return None
    try:
        return cast(v)
    except ValueError:
        raise ApiError(400, "BAD_REQUEST", f"Parametr {name} ma niepoprawną wartość.")


def _signals(counts):
    return {**counts, "ostrzezenie_dostepu": counts.get("zamkniete_na_klucz", 0) >= 2}


def _decorate(rec, counts=None, n_sources=None):
    rec = {k: v for k, v in rec.items() if not k.startswith("_")}
    rec["status_dostepnosci"] = compute_status(rec)
    rec["znacznik_aktualnosci"] = znacznik_aktualnosci(rec.get("data_ostatniego_potwierdzenia"),
                                                       current_app.config["PROG_AKTUALNOSCI_DNI"])
    rec["liczba_zrodel"] = max(n_sources or 0, 1)
    rec["dane_przykladowe"] = bool(rec.get("dane_przykladowe"))
    rec["sygnaly"] = _signals(counts or {})
    return rec


@bp.get("/aed")
def list_aed():
    lat, lon, radius = _num("lat"), _num("lon"), min(_num("radius_m") or 2000, 20000)
    if (lat is None) != (lon is None):
        raise ApiError(400, "BAD_REQUEST", "Parametry lat i lon muszą wystąpić razem.")
    sort = request.args.get("sort")
    if sort == "odleglosc" and lat is None:
        raise ApiError(400, "BAD_REQUEST", "sort=odleglosc wymaga parametrów lat i lon.")
    bbox = None
    if request.args.get("bbox"):
        try:
            bbox = [float(x) for x in request.args["bbox"].split(",")]
            assert len(bbox) == 4
        except (ValueError, AssertionError):
            raise ApiError(400, "BAD_REQUEST", "bbox: minLon,minLat,maxLon,maxLat.")
    wanted = None
    if request.args.get("status_dostepnosci"):
        wanted = set(request.args["status_dostepnosci"].split(","))
        if not wanted <= STATUSES:
            raise ApiError(400, "BAD_REQUEST", f"status_dostepnosci: {', '.join(sorted(STATUSES))}.")
    limit, offset = min(_num("limit", int) or 50, 200), _num("offset", int) or 0
    counts, srcs = repo.report_counts(), {}
    for s in repo.list_aed_sources():
        srcs[s["aed_id"]] = srcs.get(s["aed_id"], 0) + 1
    items = []
    for r in repo.list_aed_rows():
        if bbox and not (bbox[0] <= r["lon"] <= bbox[2] and bbox[1] <= r["lat"] <= bbox[3]):
            continue
        if lat is not None:
            d = round(haversine_m(lat, lon, r["lat"], r["lon"]))
            if d > radius:
                continue
            r["odleglosc_m"] = d
        item = _decorate(r, counts.get(r["aed_id"]), srcs.get(r["aed_id"]))
        status = item["status_dostepnosci"]["wartosc"]
        if (wanted and status not in wanted) or (_bool("dostepnosc_teraz") and status == "niedostepny"):
            continue
        if _bool("tylko_aktualne") and item["znacznik_aktualnosci"] != "aktualne":
            continue
        items.append(item)
    if lat is not None:
        items.sort(key=lambda i: i["odleglosc_m"])
    return jsonify({"items": items[offset:offset + limit], "liczba": len(items), "limit": limit, "offset": offset,
                    "wygenerowano": datetime.now().astimezone().isoformat(timespec="seconds")})


@bp.get("/aed/<aed_id>")
def get_aed(aed_id):
    rec = repo.get_aed_row(aed_id)
    if not rec:
        raise ApiError(404, "NOT_FOUND", "Nie znaleziono punktu AED.")
    sources = repo.list_aed_sources(aed_id)
    item = _decorate(rec, repo.report_counts().get(aed_id), len(sources))
    item["zrodla_skladowe"] = sources
    return jsonify(item)


def _require_aed(aed_id):
    if not repo.get_aed_row(aed_id):
        raise ApiError(404, "NOT_FOUND", "Nie znaleziono punktu AED.")


@bp.get("/aed/<aed_id>/reports")
def list_reports(aed_id):
    _require_aed(aed_id)
    return jsonify({"items": repo.list_reports(aed_id, min(_num("limit", int) or 50, 200))})


@bp.post("/aed/<aed_id>/reports")
def add_report(aed_id):
    """Zgłoszenie z terenu: trafia WYŁĄCZNIE do field_reports, nie zmienia rekordu AED, statusu ani eksportu."""
    _require_aed(aed_id)
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError(400, "BAD_REQUEST", "Wymagany JSON z polem 'typ'.")
    typ, comment = body.get("typ"), body.get("komentarz")
    if typ not in REPORT_TYPES:
        raise ApiError(422, "UNPROCESSABLE", f"typ: {', '.join(sorted(REPORT_TYPES))}.")
    if comment is not None and (not isinstance(comment, str) or len(comment) > 300):
        raise ApiError(422, "UNPROCESSABLE", "komentarz: tekst do 300 znaków.")
    ip_hash = hashlib.sha256(f"{request.remote_addr}{current_app.config['SECRET_KEY']}".encode()).hexdigest()[:16]
    hits = current_app.extensions.setdefault("report_hits", {}).setdefault(ip_hash, [])
    hits[:] = [t for t in hits if time.time() - t < 3600]
    if len(hits) >= current_app.config["REPORT_LIMIT_PER_HOUR"]:
        raise ApiError(429, "RATE_LIMITED", "Zbyt wiele zgłoszeń z tego adresu. Spróbuj później.")
    hits.append(time.time())
    with get_db():
        rid = repo.add_report(aed_id, typ, comment, ip_hash)
    rep = repo.get_report(rid)
    resp = jsonify({"id": f"r_{rid}", "aed_id": aed_id, "typ": typ, "utworzono": rep["utworzono"]})
    resp.status_code = 201
    return resp
