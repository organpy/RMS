"""Password hashing, session tokens and auth dependencies."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, Request, Response
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .errors import Forbidden, TooManyRequests, Unauthorized

COOKIE = "rms_session"
_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, digest = stored.split("$")
        candidate = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), **_SCRYPT)
    except ValueError:
        return False
    return hmac.compare_digest(candidate, base64.b64decode(digest))


def set_session(response: Response, staff_id: int) -> None:
    settings = get_settings()
    expires = datetime.now(timezone.utc) + timedelta(hours=settings.session_hours)
    token = jwt.encode({"sub": str(staff_id), "exp": expires}, settings.jwt_secret(), algorithm="HS256")
    response.set_cookie(
        COOKIE,
        token,
        max_age=settings.session_hours * 3600,
        httponly=True,
        samesite="strict",
        secure=settings.secure_cookies,
        path="/api",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/api")


def current_staff(request: Request, db: Session = Depends(get_db)):
    from backend.modules.staff.models import Staff

    token = request.cookies.get(COOKIE)
    if not token:
        raise Unauthorized("Not signed in")
    try:
        payload = jwt.decode(token, get_settings().jwt_secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        raise Unauthorized("Session expired") from None
    staff = db.get(Staff, int(payload["sub"]))
    if staff is None or not staff.active:
        raise Unauthorized("Account disabled")
    return staff


def require_admin(staff=Depends(current_staff)):
    if staff.role != "admin":
        raise Forbidden("Admins only")
    return staff


CurrentStaff = Annotated[object, Depends(current_staff)]


class LoginThrottle:
    """Lock a client/username pair out after repeated failures."""

    def __init__(self, attempts: int = 5, window: int = 900) -> None:
        self.attempts, self.window = attempts, window
        self._failures: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str) -> list[float]:
        cutoff = time.monotonic() - self.window
        recent = [t for t in self._failures.get(key, []) if t > cutoff]
        self._failures[key] = recent
        return recent

    def check(self, key: str) -> None:
        with self._lock:
            if len(self._recent(key)) >= self.attempts:
                raise TooManyRequests("Too many attempts. Try again in a few minutes.")

    def fail(self, key: str) -> None:
        with self._lock:
            self._recent(key).append(time.monotonic())

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)


throttle = LoginThrottle()
