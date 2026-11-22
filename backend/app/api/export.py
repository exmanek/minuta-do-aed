import json

from flask import Blueprint, Response, current_app, jsonify

from ..domain.schema import load_schema
from ..services import export as svc

bp = Blueprint("export", __name__)


def _ctx():
    cfg = current_app.config
    schema = load_schema(cfg["STANDARD_XLSX"])
    return cfg, schema, svc.collect(schema, cfg["PROG_AKTUALNOSCI_DNI"])


def _file(body, mimetype, name):
    return Response(body, mimetype=mimetype, headers={"Content-Disposition": f"attachment; filename={name}"})


@bp.get("/export/aed.csv")
def aed_csv():
    cfg, schema, recs = _ctx()
    return _file(svc.to_csv(schema, recs, cfg["CSV_DELIMITER"]), "text/csv", f"aed{svc.suffix(recs)}.csv")


@bp.get("/export/wykaz.csv")
def wykaz_csv():
    cfg, schema, recs = _ctx()
    return _file(svc.to_wykaz_csv(schema, recs, cfg["CSV_DELIMITER"]), "text/csv", f"wykaz_aed{svc.suffix(recs)}.csv")


@bp.get("/export/wykaz.json")
def wykaz_json():
    _, schema, recs = _ctx()
    return jsonify(svc.to_wykaz_json(schema, recs))


@bp.get("/export/aed.json")
def aed_json():
    _, schema, recs = _ctx()
    return _file(json.dumps(svc.to_json(schema, recs), ensure_ascii=False, indent=1), "application/json",
                 f"aed{svc.suffix(recs)}.json")


@bp.get("/export/aed.geojson")
def aed_geojson():
    _, schema, recs = _ctx()
    return _file(json.dumps(svc.to_geojson(schema, recs), ensure_ascii=False), "application/geo+json",
                 f"aed{svc.suffix(recs)}.geojson")


@bp.get("/export/zrodla.csv")
def zrodla():
    cfg, _, recs = _ctx()
    return _file(svc.sources_csv(recs, cfg["CSV_DELIMITER"]), "text/csv", "zrodla.csv")


@bp.get("/export/aed_zrodla.csv")
def aed_zrodla():
    cfg, _, recs = _ctx()
    return _file(svc.links_csv(recs, cfg["CSV_DELIMITER"]), "text/csv", "aed_zrodla.csv")


@bp.get("/export/metadata.json")
def metadata_json():
    cfg, _, recs = _ctx()
    return jsonify(svc.metadata(recs, cfg))


@bp.get("/export/metadata.xml")
def metadata_xml():
    cfg, _, recs = _ctx()
    return Response(svc.metadata_xml(svc.metadata(recs, cfg)), mimetype="application/xml")
