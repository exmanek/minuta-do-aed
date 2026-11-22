from pathlib import Path

from flask import Flask, jsonify, send_from_directory

from .config import Config
from .errors import ApiError, register_error_handlers
from .storage import db


def create_app(config=None):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)
    if config:
        app.config.update(config)
    app.json.sort_keys = False  # kolejność pól jak w XLSX
    register_error_handlers(app)
    db.init_app(app)

    from .api import aed_public, export, meta, provider, provider_aed
    for module in (meta, aed_public, provider, provider_aed, export):
        app.register_blueprint(module.bp, url_prefix="/api/v1")

    @app.route("/api/<path:_rest>")
    def api_not_found(_rest):
        raise ApiError(404, "NOT_FOUND", "Nieznany endpoint API.")

    # Demo/produkcja: Flask serwuje zbudowany frontend (jeden origin).
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def spa(path):
        dist = Path(app.config["FRONTEND_DIST"])
        if not (dist / "index.html").exists():
            return jsonify({"info": "Frontend nie jest zbudowany. Uruchom `npm run build` w frontend/ albo użyj Vite (5173)."}), 404
        if path and (dist / path).is_file():
            return send_from_directory(dist, path)
        return send_from_directory(dist, "index.html")

    return app
