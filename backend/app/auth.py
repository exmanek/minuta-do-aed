"""Uwierzytelnianie dostawcy (niezależne od walidacji składni REGON).
Token: podpisana struktura {regon} z czasem ważności. Status 'zweryfikowany' nadaje seed (symulacja administratora)."""
from datetime import datetime, timedelta
from functools import wraps

from flask import current_app, g, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

from .errors import ApiError
from .storage import repo

TOKEN_TTL_SECONDS = 8 * 3600


def _serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="provider-token")


def hash_password(password):
    return generate_password_hash(password)


def check_password(provider, password):
    return check_password_hash(provider["haslo_hash"], password)


def issue_token(regon):
    valid_to = datetime.now().astimezone() + timedelta(seconds=TOKEN_TTL_SECONDS)
    return _serializer().dumps({"regon": regon}), valid_to.isoformat(timespec="seconds")


def provider_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            raise ApiError(401, "AUTH_REQUIRED", "Wymagany token dostawcy (Authorization: Bearer ...).")
        try:
            data = _serializer().loads(header[7:], max_age=TOKEN_TTL_SECONDS)
        except SignatureExpired:
            raise ApiError(401, "AUTH_REQUIRED", "Token wygasł.")
        except BadSignature:
            raise ApiError(401, "AUTH_REQUIRED", "Niepoprawny token.")
        provider = repo.get_provider(data.get("regon"))
        if not provider:
            raise ApiError(401, "AUTH_REQUIRED", "Konto dostawcy nie istnieje.")
        if provider["status_weryfikacji"] != "zweryfikowany":
            raise ApiError(403, "PROVIDER_NOT_VERIFIED", "Konto dostawcy nie zostało zweryfikowane przez administratora.")
        g.provider = provider
        return fn(*args, **kwargs)
    return wrapper
