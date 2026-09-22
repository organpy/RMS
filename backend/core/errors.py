"""Domain errors mapped to HTTP responses."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    status_code = 400

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class NotFound(AppError):
    status_code = 404


class Conflict(AppError):
    status_code = 409


class Unauthorized(AppError):
    status_code = 401


class Forbidden(AppError):
    status_code = 403


class TooManyRequests(AppError):
    status_code = 429


def register(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
