from datetime import datetime

from flask import Blueprint, current_app, jsonify, request

from ..errors import ApiError
from ..services.freshness import znacznik_aktualnosci
from ..services.geo import haversine_m
from ..storage import repo

bp = Blueprint("aed_public", __name__)


def _decorate(rec):
    rec = dict(rec)
    rec["znacznik_aktualnosci"] = znacznik_aktualnosci(
        rec.get("data_ostatniego_potwierdzenia"), current_app.config["PROG_AKTUALNOSCI_DNI"])
    # TODO(backend): services/availability.py liczy status z czterech aspektów. Do tego czasu "nieznany".
    rec["status_dostepnosci"] = {"wartosc": "nieznany", "powod": "obliczanie statusu jeszcze niezaimplementowane",
                                 "brakujace": [], "na_chwile": datetime.now().astimezone().isoformat(timespec="seconds")}
    rec["sygnaly"] = {"ostrzezenie_dostepu": False}
    return rec


def _float(name):
    v = request.args.get(name)
    if v is None:
        return None
    try:
        return float(v)
    except ValueError:
        raise ApiError(400, "BAD_REQUEST", f"Parametr {name} musi być liczbą.")


@bp.get("/aed")
def list_aed():
    lat, lon = _float("lat"), _float("lon")
    if (lat is None) != (lon is None):
        raise ApiError(400, "BAD_REQUEST", "Parametry lat i lon muszą wystąpić razem.")
    radius = min(_float("radius_m") or 2000, 20000)
    limit = min(int(request.args.get("limit", 50)), 200)
    offset = int(request.args.get("offset", 0))
    items = [_decorate(r) for r in repo.list_aed_rows()]
    if request.args.get("tylko_aktualne") in ("true", "1"):
        items = [i for i in items if i["znacznik_aktualnosci"] == "aktualne"]
    if lat is not None:
        for i in items:
            i["odleglosc_m"] = round(haversine_m(lat, lon, i["lat"], i["lon"]))
        items = sorted((i for i in items if i["odleglosc_m"] <= radius), key=lambda i: i["odleglosc_m"])
    total = len(items)
    return jsonify({"items": items[offset:offset + limit], "liczba": total, "limit": limit, "offset": offset,
                    "wygenerowano": datetime.now().astimezone().isoformat(timespec="seconds")})


@bp.get("/aed/<aed_id>")
def get_aed(aed_id):
    rec = repo.get_aed_row(aed_id)
    if not rec:
        raise ApiError(404, "NOT_FOUND", "Nie znaleziono punktu AED.")
    return jsonify(_decorate(rec))
