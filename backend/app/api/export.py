from flask import Blueprint, Response, current_app, jsonify

from ..domain.schema import load_schema
from ..services import export as svc
from ..storage import repo

bp = Blueprint("export", __name__)


def _schema():
    return load_schema(current_app.config["STANDARD_XLSX"])


@bp.get("/export/aed.csv")
def aed_csv():
    body = svc.to_csv(_schema(), repo.list_aed_rows(), current_app.config["CSV_DELIMITER"])
    return Response(body, mimetype="text/csv", headers={"Content-Disposition": "attachment; filename=aed.csv"})


@bp.get("/export/aed.json")
def aed_json():
    resp = jsonify(svc.to_json(_schema(), repo.list_aed_rows()))
    resp.headers["Content-Disposition"] = "attachment; filename=aed.json"
    return resp
