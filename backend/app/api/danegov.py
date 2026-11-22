"""Import danych o AED z portalu dane.gov.pl. Dalej działa zwykły przepływ partii (mapowanie, walidacja, zatwierdzenie)."""
from flask import Blueprint, g, jsonify, request

from ..auth import provider_required
from ..errors import ApiError
from ..services import danegov, ingest, pipeline
from ..storage import repo

bp = Blueprint("danegov", __name__)
MAX_DATASETS = 10


@bp.get("/provider/danegov/catalog")
@provider_required
def catalog():
    """Zbiory AED znalezione w portalu (cache 10 min; ?refresh=true wymusza ponowne pobranie)."""
    return jsonify(danegov.discover(refresh=request.args.get("refresh", "").lower() in ("1", "true", "tak")))


@bp.post("/provider/danegov/import")
@provider_required
def import_datasets():
    body = request.get_json(silent=True)
    ids = body.get("zbiory") if isinstance(body, dict) else None
    if not isinstance(ids, list) or not ids or len(ids) > MAX_DATASETS or not all(isinstance(i, (str, int)) for i in ids):
        raise ApiError(400, "BAD_REQUEST", f"Pole 'zbiory' musi być listą od 1 do {MAX_DATASETS} identyfikatorów zbiorów.")
    catalog_items = {i["dataset_id"]: i for i in danegov.discover()["items"]}
    files, metas, skipped, upstream = [], [], [], None
    for did in dict.fromkeys(str(i) for i in ids):
        item = catalog_items.get(did)
        if not item:
            skipped.append({"dataset_id": did, "powod": "Nieznany zbiór – odśwież katalog."})
        elif not item["mozna_importowac"]:
            skipped.append({"dataset_id": did, "tytul": item["tytul"], "powod": item["powod_pominiecia"]})
        else:
            try:
                name, raw = danegov.download(item)
                ingest.parse_file(name, raw)  # odrzucamy tylko ten zbiór, jeśli plik jest nieczytelny
            except ApiError as e:
                upstream = upstream or (e if e.status in (502, 504) else None)
                skipped.append({"dataset_id": did, "tytul": item["tytul"], "powod": e.message})
            else:
                files.append((name, raw))
                metas.append(danegov.source_meta(item))
    if not files:
        if upstream:
            raise upstream
        raise ApiError(422, "UNPROCESSABLE", "Żaden z wybranych zbiorów nie nadaje się do importu.",
                       [{"komunikat": f"{s.get('tytul') or s['dataset_id']}: {s['powod']}"} for s in skipped])
    batch_id = pipeline.create_batch(g.provider, files, metas)
    view = pipeline.batch_view(repo.get_batch(batch_id))
    view["pominiete"] = skipped
    resp = jsonify(view)
    resp.status_code = 201
    return resp
