"""Centralized API error handlers with localized error contract."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger

from app.i18n.context import get_current_locale
from app.i18n.errors import build_error_payload, infer_error_code


def _resolve_request_locale(request: Request) -> str:
    locale = getattr(request.state, "locale", None)
    if locale:
        return locale
    return get_current_locale()


def _extract_detail_payload(detail: Any) -> tuple[Optional[str], Optional[str], Any]:
    """Extract custom error_code/message/detail from HTTPException.detail."""
    if isinstance(detail, dict):
        return detail.get("error_code"), detail.get("message"), detail.get("detail")
    return None, None, detail


def _sanitize_for_json(value: Any) -> Any:
    """Convert non-JSON-serializable validation artifacts into plain data."""
    if isinstance(value, dict):
        return {key: _sanitize_for_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_sanitize_for_json(item) for item in value]
    if isinstance(value, BaseException):
        return str(value)
    return value


def register_error_handlers(app: FastAPI) -> None:
    """Attach global exception handlers for localized API errors."""

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(request: Request, exc: RequestValidationError):
        locale = _resolve_request_locale(request)
        payload = build_error_payload(
            error_code="VALIDATION_ERROR",
            locale=locale,
            detail=_sanitize_for_json(exc.errors()),
        )
        return JSONResponse(status_code=422, content=payload)

    @app.exception_handler(HTTPException)
    async def _handle_http_exception(request: Request, exc: HTTPException):
        locale = _resolve_request_locale(request)
        explicit_code, explicit_message, detail_payload = _extract_detail_payload(exc.detail)

        error_code = explicit_code or infer_error_code(exc.status_code, detail_payload)
        payload = build_error_payload(
            error_code=error_code,
            locale=locale,
            detail=detail_payload,
            message=explicit_message,
        )
        return JSONResponse(status_code=exc.status_code, content=payload)

    @app.exception_handler(Exception)
    async def _handle_unexpected_exception(request: Request, exc: Exception):
        logger.exception("Unhandled API exception: {}", exc)
        locale = _resolve_request_locale(request)
        payload = build_error_payload(
            error_code="INTERNAL_ERROR",
            locale=locale,
            detail=str(exc),
        )
        return JSONResponse(status_code=500, content=payload)
