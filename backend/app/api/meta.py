from flask import Blueprint, current_app, jsonify

from ..domain.schema import load_schema

bp = Blueprint("meta", __name__)


@bp.get("/health")
def health():
    return jsonify({"status": "ok", "service": "misja-aed-api", "wersja_api": "v1"})


@bp.get("/meta/schema")
def meta_schema():
    return jsonify(load_schema(current_app.config["STANDARD_XLSX"]))
