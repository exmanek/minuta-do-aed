from flask import jsonify
from werkzeug.exceptions import HTTPException

_CODES = {
    400: "BAD_REQUEST", 401: "AUTH_REQUIRED", 403: "FORBIDDEN", 404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED", 409: "STATE_CONFLICT", 413: "FILE_TOO_LARGE",
    415: "UNSUPPORTED_FORMAT", 502: "UPSTREAM_ERROR", 504: "UPSTREAM_TIMEOUT", 422: "UNPROCESSABLE", 429: "RATE_LIMITED",
}


class ApiError(Exception):
    def __init__(self, status, code, message, details=None):
        super().__init__(message)
        self.status, self.code, self.message, self.details = status, code, message, details or []


def error_response(status, code, message, details=None):
    resp = jsonify({"error": {"code": code, "message": message, "details": details or []}})
    resp.status_code = status
    return resp


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def _api(e):
        return error_response(e.status, e.code, e.message, e.details)

    @app.errorhandler(HTTPException)
    def _http(e):
        return error_response(e.code, _CODES.get(e.code, "HTTP_ERROR"), e.description)

    @app.errorhandler(Exception)
    def _any(e):
        app.logger.exception("Unhandled error")
        return error_response(500, "INTERNAL_ERROR", "Wewnętrzny błąd serwera.")
