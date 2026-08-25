"""
Centralised error handling.

Contract: a client never receives a stack trace, an internal file path, a
database driver message, or any other implementation detail. It receives a
short generic message plus a correlation id. The FULL detail — traceback,
request context, driver error — is written to the server log against that same
id, so an on-call engineer can reconstruct the failure from the id alone.

Wire it up once in main.py:  install_error_handlers(app)
"""
from __future__ import annotations

import logging
import os
import uuid

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("securedesk.error")

# In production we never echo an exception message back to the caller. In local
# development it is useful, so it is opt-in and defaults to OFF.
EXPOSE_ERRORS = os.getenv("EXPOSE_ERROR_DETAIL", "").lower() in ("1", "true", "yes")

GENERIC_500 = "Something went wrong on our end. Please try again."
GENERIC_DB = "We couldn't reach the data store. Please try again in a moment."

# Driver/exception class names that indicate a storage-layer failure. Their
# messages routinely contain hostnames, credentials and collection names, so
# they are never forwarded.
_DB_ERRORS = (
    "ServerSelectionTimeoutError", "AutoReconnect", "NetworkTimeout",
    "OperationFailure", "ConnectionFailure", "PyMongoError",
    "DuplicateKeyError", "WriteError", "ConfigurationError",
    # Phase 6: the evidence-write circuit breaker (core/circuit_breaker.py)
    # only ever opens because of a run of PyMongoError failures today, so
    # the same "we couldn't reach the data store" message is accurate —
    # not a generic 500, and nothing about *why* the breaker is open (host,
    # credentials) ever reaches the client either way.
    "CircuitOpenError",
)


def _error_id() -> str:
    return uuid.uuid4().hex[:12]


def _request_id(request: Request) -> str | None:
    # Set by main.py's request_id_middleware (Phase 7) on every request.
    # Optional lookup: a handler invoked outside that middleware (there
    # isn't one today) simply omits request_id rather than failing.
    return getattr(request.state, "request_id", None)


def _context(request: Request) -> dict:
    return {
        "method": request.method,
        "path": request.url.path,
        "client": request.client.host if request.client else None,
        "request_id": _request_id(request),
    }


def _body(eid: str, message: str, request_id: str | None = None) -> dict:
    body = {"detail": message, "error_id": eid}
    if request_id:
        body["request_id"] = request_id
    return body


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        # Deliberate, developer-authored messages (401/403/404/400) are safe to
        # return as-is — they are written for the user. Only 5xx is scrubbed.
        if exc.status_code >= 500:
            eid = _error_id()
            log.error(
                "unhandled_http_5xx id=%s status=%s detail=%r ctx=%s",
                eid, exc.status_code, exc.detail, _context(request),
            )
            return JSONResponse(status_code=exc.status_code, content=_body(eid, GENERIC_500, _request_id(request)))
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        # Pydantic's raw errors echo submitted values back, which can include a
        # password or a pasted secret. Report only where the problem is.
        fields = []
        for err in exc.errors():
            loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path")]
            fields.append({"field": ".".join(loc) or "request", "problem": err.get("msg", "invalid")})
        log.info("validation_error path=%s fields=%s", request.url.path, fields)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Some of the submitted values aren't valid.", "fields": fields},
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        eid = _error_id()
        name = type(exc).__name__
        is_db = name in _DB_ERRORS or "pymongo" in type(exc).__module__

        # exc_info=True writes the full traceback to the server log only.
        log.exception("unhandled id=%s type=%s ctx=%s", eid, name, _context(request), exc_info=exc)

        message = GENERIC_DB if is_db else GENERIC_500
        if EXPOSE_ERRORS:
            message = f"{message} [dev: {name}: {exc}]"
        return JSONResponse(status_code=500, content=_body(eid, message, _request_id(request)))


def safe_502(eid_log_msg: str, exc: Exception) -> HTTPException:
    """
    For an upstream/3rd-party failure inside a route: log the real cause, raise
    a clean 502. Use instead of embedding str(exc) in the response.
    """
    eid = _error_id()
    log.error("upstream_failure id=%s %s: %s: %s", eid, eid_log_msg, type(exc).__name__, exc)
    return HTTPException(
        status_code=502,
        detail=f"An upstream service is unavailable. Please try again. (ref {eid})",
    )
