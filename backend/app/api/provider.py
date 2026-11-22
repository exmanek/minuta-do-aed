import json

from flask import Blueprint, Response, current_app, g, jsonify, request

from ..auth import check_password, issue_token, provider_required
from ..domain.schema import load_schema
from ..errors import ApiError
from ..services import export as export_svc
from ..services import pipeline
from ..services.regon import is_valid_regon_format
from ..storage import repo
from ..storage.db import get_db

bp = Blueprint("provider", __name__)


def _json_body():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError(400, "BAD_REQUEST", "Wymagane ciało JSON (obiekt).")
    return body


def _public(p):
    return {"regon": p["regon"], "nazwa": p["nazwa"], "status_weryfikacji": p["status_weryfikacji"]}


@bp.post("/provider/login")
def login():
    """Kolejność: składnia REGON (422) -> hasło (401) -> status konta (403). Poprawny REGON NIE potwierdza tożsamości."""
    body = _json_body()
    if not body.get("regon") or not body.get("haslo"):
        raise ApiError(400, "BAD_REQUEST", "Wymagane pola: regon, haslo.")
    regon = str(body["regon"])
    if not is_valid_regon_format(regon):
        raise ApiError(422, "INVALID_REGON", "Numer REGON ma niepoprawny format.")
    p = repo.get_provider(regon)
    if not p or not check_password(p, str(body["haslo"])):
        raise ApiError(401, "INVALID_CREDENTIALS", "Błędny REGON lub hasło.")
    if p["status_weryfikacji"] != "zweryfikowany":
        raise ApiError(403, "PROVIDER_NOT_VERIFIED", "Konto nie zostało zweryfikowane przez administratora.")
    token, valid_to = issue_token(regon)
    return jsonify({"token": token, "wazny_do": valid_to, "dostawca": _public(p)})


@bp.get("/provider/me")
@provider_required
def me():
    return jsonify(_public(g.provider))


@bp.get("/provider/sources")
@provider_required
def sources():
    items = [{"zrodlo_id": s["id"], "nazwa": s["nazwa"], "url": s["url"], "format": s["format"], "licencja": s["licencja"],
              "prawo_do_udostepniania": s["prawo_do_udostepniania"], "dysponent_nazwa": s["dysponent_nazwa"],
              "dysponent_regon": s["dysponent_regon"], "zakres_referencyjny": s["zakres"],
              "dane_przykladowe": s["dane_przykladowe"], "wczytano": s["wczytano"]}
             for s in repo.list_sources(g.provider["regon"])]
    return jsonify({"items": items})


def _own_batch(batch_id):
    b = repo.get_batch(batch_id)
    if not b:
        raise ApiError(404, "NOT_FOUND", "Nie znaleziono partii.")
    if b["regon_dostawcy"] != g.provider["regon"]:
        raise ApiError(403, "FORBIDDEN", "Partia należy do innego dostawcy.")
    return b


@bp.post("/provider/batches")
@provider_required
def create_batch():
    files = request.files.getlist("files")
    if not files or len(files) > 10:
        raise ApiError(400, "BAD_REQUEST", "Wymagane od 1 do 10 plików w polu 'files'.")
    try:
        metas = json.loads(request.form["meta"]) if request.form.get("meta") else [{} for _ in files]
    except ValueError:
        raise ApiError(400, "BAD_REQUEST", "Pole 'meta' musi być poprawnym JSON.")
    if not isinstance(metas, list) or len(metas) != len(files) or not all(isinstance(m, dict) for m in metas):
        raise ApiError(400, "BAD_REQUEST", "Pole 'meta' musi być tablicą opisów źródeł (po jednym na plik, w tej samej kolejności).")
    bid = pipeline.create_batch(g.provider, [(f.filename, f.read()) for f in files], metas)
    resp = jsonify(pipeline.batch_view(repo.get_batch(bid)))
    resp.status_code = 201
    return resp


@bp.get("/provider/batches/<batch_id>")
@provider_required
def get_batch(batch_id):
    return jsonify(pipeline.batch_view(_own_batch(batch_id)))


@bp.put("/provider/batches/<batch_id>/mapping")
@provider_required
def put_mapping(batch_id):
    batch = _own_batch(batch_id)
    pipeline.approve_mapping(batch, _json_body().get("mapowanie"))
    return jsonify({"batch_id": batch_id, "status": "zmapowana"})


@bp.post("/provider/batches/<batch_id>/process")
@provider_required
def process_batch(batch_id):
    return jsonify(pipeline.process_batch(_own_batch(batch_id), g.provider))


@bp.get("/provider/batches/<batch_id>/report")
@provider_required
def report(batch_id):
    batch, level, fmt = _own_batch(batch_id), request.args.get("poziom"), request.args.get("format", "json")
    if level not in (None, "blad", "ostrzezenie") or fmt not in ("json", "csv"):
        raise ApiError(400, "BAD_REQUEST", "poziom: blad|ostrzezenie, format: json|csv.")
    out = pipeline.report(batch, level, fmt)
    if fmt == "csv":
        return Response(out, mimetype="text/csv", headers={"Content-Disposition": f"attachment; filename=raport_{batch_id}.csv"})
    return jsonify(out)


@bp.get("/provider/batches/<batch_id>/duplicates")
@provider_required
def duplicates(batch_id):
    return jsonify({"items": pipeline.duplicates_view(_own_batch(batch_id), g.provider)})


@bp.post("/provider/batches/<batch_id>/duplicates/decisions")
@provider_required
def decisions(batch_id):
    n = pipeline.apply_decisions(_own_batch(batch_id), g.provider, _json_body().get("decyzje"))
    return jsonify({"zapisane": n})


@bp.post("/provider/batches/<batch_id>/commit")
@provider_required
def commit(batch_id):
    return jsonify(pipeline.commit_batch(_own_batch(batch_id), g.provider, _json_body()))


@bp.get("/provider/batches/<batch_id>/export")
@provider_required
def batch_export(batch_id):
    batch, fmt = _own_batch(batch_id), request.args.get("format", "csv")
    if batch["status"] != "zatwierdzona":
        raise ApiError(409, "STATE_CONFLICT", "Eksport dostępny po zatwierdzeniu partii.")
    if fmt not in ("csv", "json", "geojson", "zip"):
        raise ApiError(400, "BAD_REQUEST", "format: csv, json, geojson lub zip.")
    cfg = current_app.config
    schema = load_schema(cfg["STANDARD_XLSX"])
    ids = set(repo.aed_ids_for_sources([bs["source_id"] for bs in repo.list_batch_sources(batch_id)]))
    recs = export_svc.collect(schema, cfg["PROG_AKTUALNOSCI_DNI"], g.provider["regon"], ids)
    sfx = export_svc.suffix(recs)
    body, mime = {
        "csv": lambda: (export_svc.to_csv(schema, recs, cfg["CSV_DELIMITER"]), "text/csv"),
        "json": lambda: (json.dumps(export_svc.to_json(schema, recs), ensure_ascii=False, indent=1), "application/json"),
        "geojson": lambda: (json.dumps(export_svc.to_geojson(schema, recs), ensure_ascii=False), "application/geo+json"),
        "zip": lambda: (export_svc.build_zip(schema, recs, cfg), "application/zip"),
    }[fmt]()
    with get_db():
        repo.set_export_time(batch_id)
    return Response(body, mimetype=mime, headers={"Content-Disposition": f"attachment; filename=aed{sfx}.{fmt}"})
