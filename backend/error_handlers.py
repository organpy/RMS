"""Exception handler registration for the FastAPI application."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .exceptions import AppError
from .schemas.common import ErrorResponse

logger = logging.getLogger(__name__)


def _build_error_response(detail: str, code: str, *, status_code: int, errors: Any | None = None) -> JSONResponse:
    payload = ErrorResponse(detail=detail, code=code, errors=errors)
    return JSONResponse(status_code=status_code, content=payload.model_dump())


def register_exception_handlers(app: FastAPI) -> None:
    """Attach custom exception handlers to the FastAPI application."""

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        logger.info("Handled AppError", extra={"path": request.url.path, "code": exc.code, "detail": exc.message})
        payload = exc.to_dict()
        return _build_error_response(
            payload.get("detail", "Application error"),
            payload.get("code", "app_error"),
            status_code=exc.status_code,
            errors=payload.get("extra"),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.debug(
            "Request validation error",
            extra={"path": request.url.path, "errors": exc.errors()},
        )
        return _build_error_response(
            "Input validation failed",
            "request_validation_error",
            status_code=422,
            errors=exc.errors(),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        logger.info(
            "HTTP exception",
            extra={"path": request.url.path, "status_code": exc.status_code, "detail": exc.detail},
        )
        detail = exc.detail if isinstance(exc.detail, str) else "HTTP error"
        return _build_error_response(detail, "http_error", status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def handle_unexpected_exception(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception", extra={"path": request.url.path})
        return _build_error_response("Internal server error", "internal_error", status_code=500)
