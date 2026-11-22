"""Pojedyncze AED dostawcy: walidacja na żywo, dodanie, aktualizacja, wycofanie, historia."""
from datetime import date

from flask import Blueprint, current_app, g, jsonify, request

from ..auth import provider_required
from ..domain.schema import field_names, load_schema
from ..errors import ApiError
from ..services import declarations, validation
from ..services.mapping import _num
from ..storage import repo
from ..storage.db import get_db
from .aed_public import _decorate

bp = Blueprint("provider_aed", __name__)
EDITABLE_SKIP = {"aed_id", "data_ostatniej_edycji", "data_importu", "nazwa_dostawcy", "regon_dostawcy", "oswiadczenie_prawdziwosci"}


def _body():
    b = request.get_json(silent=True)
    if not isinstance(b, dict):
        raise ApiError(400, "BAD_REQUEST", "Wymagane ciało JSON (obiekt).")
    return b


def _schema():
    return load_schema(current_app.config["STANDARD_XLSX"])


def _build(body, base=None):
    """Rekord z pól formularza; dostawca zawsze z konta, wartości domyślne dla pól ręcznego wprowadzenia."""
    schema = _schema()
    rec = {f: (base or {}).get(f) for f in field_names(schema)}
    for f in field_names(schema):
        if f in body and f not in EDITABLE_SKIP:
            v = body[f]
            rec[f] = v.strip() or None if isinstance(v, str) else v
    for f in ("lat", "lon"):
        if rec.get(f) is not None:
            rec[f] = _num(rec[f])
    p = g.provider
    rec["nazwa_dostawcy"], rec["regon_dostawcy"] = p["nazwa"], p["regon"]
    rec["dysponent_nazwa"] = rec.get("dysponent_nazwa") or p["nazwa"]
    rec["zrodlo_danych"] = rec.get("zrodlo_danych") or "Wprowadzenie ręczne"
    rec["zakres_referencyjny"] = rec.get("zakres_referencyjny") or "Punkt wprowadzony ręcznie przez dostawcę"
    rec["dane_przykladowe"] = bool(body.get("dane_przykladowe", (base or {}).get("dane_przykladowe", False)))
    return rec


def _issues(rec, ref=None):
    return validation.validate_record(rec, _schema(), ref, current_app.config["PROG_AKTUALNOSCI_DNI"])


def _check_declarations(body):
    ok = all(body.get(k) is True for k in ("oswiadczenie_prawdziwosci", "oswiadczenie_prawa_do_udostepniania"))
    if not ok or body.get("wersja_tresci") != declarations.VERSION:
        raise ApiError(422, "DECLARATION_REQUIRED", "Wymagane oba oświadczenia w aktualnej wersji treści "
                       f"({declarations.VERSION}).", [{"regula": "AED-PROV-002", "poziom": "blad"}])


def _own(aed_id):
    rec = repo.get_aed_row(aed_id, include_withdrawn=True)
    if not rec:
        raise ApiError(404, "NOT_FOUND", "Nie znaleziono punktu AED.")
    if rec.get("regon_dostawcy") != g.provider["regon"]:
        raise ApiError(403, "FORBIDDEN", "Punkt należy do innego dostawcy.")
    return rec


def _save(rec, body, aed_id, base):
    regon, today = g.provider["regon"], date.today().isoformat()
    rec["data_ostatniej_edycji"] = today
    rec["oswiadczenie_prawdziwosci"] = True
    potwierdzam = body.get("potwierdzam_aktualnosc") is True
    if potwierdzam:
        rec["data_ostatniego_potwierdzenia"] = today  # tylko jawne działanie dostawcy
    fields = field_names(_schema())
    with get_db():
        rec["aed_id"] = aed_id
        diff = {f: {"przed": (base or {}).get(f), "po": rec.get(f)} for f in fields if (base or {}).get(f) != rec.get(f)}
        if base:
            repo.update_aed(aed_id, rec)
        else:
            repo.insert_aed(aed_id, rec, regon)
        repo.append_history(aed_id, "edycja" if base else "utworzenie", regon, {"pola": diff})
        if potwierdzam:
            repo.append_history(aed_id, "potwierdzenie", regon, {"data": today})
        for typ in ("prawdziwosc", "prawo_do_udostepniania") + (("aktualnosc",) if potwierdzam else ()):
            repo.append_declaration(regon, typ, None, aed_id, declarations.VERSION, declarations.content_hash(typ), {"aed_id": aed_id})
    return _decorate(repo.get_aed_row(aed_id))


@bp.get("/provider/aed")
@provider_required
def list_own():
    try:
        limit, offset = min(int(request.args.get("limit", 50)), 200), int(request.args.get("offset", 0))
    except ValueError:
        raise ApiError(400, "BAD_REQUEST", "limit i offset muszą być liczbami.")
    rows = repo.list_aed_rows(g.provider["regon"], include_withdrawn=True)
    return jsonify({"items": [_decorate(r) | {"status": r["_status"]} for r in rows[offset:offset + limit]], "liczba": len(rows)})


@bp.post("/provider/aed/validate")
@provider_required
def validate_live():
    body = _body()
    base = repo.get_aed_row(body["aed_id"], include_withdrawn=True) if body.get("aed_id") else None
    if base and base.get("regon_dostawcy") != g.provider["regon"]:
        base = None
    issues = _issues(_build(body, base), body.get("aed_id"))
    return jsonify({"problemy": issues, "mozna_zapisac": not validation.has_blocking(issues)})


@bp.post("/provider/aed")
@provider_required
def create():
    body = _body()
    _check_declarations(body)
    aed_id = body.get("aed_id")
    if aed_id and repo.get_aed_row(aed_id, include_withdrawn=True):
        raise ApiError(409, "STATE_CONFLICT", "Punkt o takim aed_id już istnieje.")
    rec = _build(body)
    issues = _issues(rec, aed_id)
    if validation.has_blocking(issues):
        raise ApiError(422, "VALIDATION_BLOCKING", "Rekord zawiera błędy blokujące.", [i for i in issues if i["poziom"] == "blad"])
    resp = jsonify(_save(rec, body, aed_id or repo.next_aed_id(), None))
    resp.status_code = 201
    return resp


@bp.put("/provider/aed/<aed_id>")
@provider_required
def update(aed_id):
    base, body = _own(aed_id), _body()
    _check_declarations(body)
    rec = _build(body, base)
    issues = _issues(rec, aed_id)
    if validation.has_blocking(issues):
        raise ApiError(422, "VALIDATION_BLOCKING", "Rekord zawiera błędy blokujące.", [i for i in issues if i["poziom"] == "blad"])
    return jsonify(_save(rec, body, aed_id, base))


@bp.delete("/provider/aed/<aed_id>")
@provider_required
def withdraw(aed_id):
    base = _own(aed_id)
    with get_db():
        repo.set_aed_status(aed_id, "wycofany")
        repo.append_history(aed_id, "wycofanie", g.provider["regon"], {"poprzedni_status": base["_status"]})
    return jsonify({"aed_id": aed_id, "status": "wycofany"})


@bp.get("/provider/aed/<aed_id>/history")
@provider_required
def history(aed_id):
    _own(aed_id)
    try:
        limit = min(int(request.args.get("limit", 100)), 500)
    except ValueError:
        raise ApiError(400, "BAD_REQUEST", "limit musi być liczbą.")
    hist = repo.list_history(aed_id, limit)
    batches = sorted({h["zmiany"]["batch_id"] for h in hist if isinstance(h["zmiany"], dict) and h["zmiany"].get("batch_id")})
    return jsonify({"historia": hist, "deklaracje": repo.list_declarations(aed_id, batches)})
