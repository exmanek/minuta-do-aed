from flask import Blueprint, current_app, jsonify, send_file

from ..domain.schema import load_schema
from ..services import declarations

bp = Blueprint("meta", __name__)


@bp.get("/health")
def health():
    return jsonify({"status": "ok", "service": "misja-aed-api", "wersja_api": "v1"})


@bp.get("/meta/schema")
def meta_schema():
    return jsonify(load_schema(current_app.config["STANDARD_XLSX"]))


@bp.get("/meta/oswiadczenie")
def meta_declarations():
    return jsonify(declarations.as_payload())


@bp.get("/standard/template.xlsx")
def template():
    return send_file(current_app.config["STANDARD_XLSX"], as_attachment=True, download_name="Wzorcowy_zakres_danych_AED.xlsx")
