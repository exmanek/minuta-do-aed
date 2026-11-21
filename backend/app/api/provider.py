from flask import Blueprint, request

from ..errors import ApiError
from ..services.regon import is_valid_regon_format

bp = Blueprint("provider", __name__)


def _not_implemented(what):
    raise ApiError(501, "NOT_IMPLEMENTED", f"{what}: endpoint zdefiniowany w kontrakcie, implementacja backendu w toku.")


@bp.post("/provider/login")
def login():
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or not body.get("regon") or not body.get("haslo"):
        raise ApiError(400, "BAD_REQUEST", "Wymagane pola: regon, haslo.")
    if not is_valid_regon_format(str(body["regon"])):
        raise ApiError(422, "INVALID_REGON", "Numer REGON ma niepoprawny format.")
    _not_implemented("Logowanie dostawcy (hasło, status weryfikacji, token)")


@bp.post("/provider/batches")
def create_batch():
    _not_implemented("Wczytanie partii")


@bp.get("/provider/batches/<batch_id>")
def get_batch(batch_id):
    _not_implemented("Stan partii")


@bp.post("/provider/batches/<batch_id>/process")
def process_batch(batch_id):
    _not_implemented("Przetwarzanie partii")


@bp.post("/provider/batches/<batch_id>/commit")
def commit_batch(batch_id):
    _not_implemented("Zatwierdzenie partii")
