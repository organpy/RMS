"""Application-specific exception classes."""

from __future__ import annotations

from typing import Any, Mapping


class AppError(Exception):
    """Base class for domain-specific errors exposed via the API."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 400,
        code: str = "app_error",
        extra: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.extra = dict(extra or {})

    def to_dict(self) -> dict[str, Any]:
        payload = {"detail": self.message, "code": self.code}
        if self.extra:
            payload["extra"] = self.extra
        return payload


class NotFoundError(AppError):
    """Raised when a requested resource is missing."""

    def __init__(self, message: str = "Resource not found", *, code: str = "not_found") -> None:
        super().__init__(message, status_code=404, code=code)


class ValidationError(AppError):
    """Domain-level validation error that is separate from request validation."""

    def __init__(self, message: str, *, extra: Mapping[str, Any] | None = None) -> None:
        super().__init__(message, status_code=422, code="validation_error", extra=extra)


class AuthenticationError(AppError):
    """Raised when authentication fails (invalid/missing token)."""

    def __init__(self, message: str = "Invalid or missing authentication token") -> None:
        super().__init__(message, status_code=401, code="authentication_error")


class UnauthorizedError(AppError):
    """Raised when authenticated user lacks permission for the resource."""

    def __init__(self, message: str = "Insufficient permissions") -> None:
        super().__init__(message, status_code=403, code="unauthorized_error")

