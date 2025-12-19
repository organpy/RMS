"""Database engine, session management, and initialization helpers."""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Generator, Annotated

import jwt
from fastapi import Depends, Header

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, scoped_session, sessionmaker

from .config import get_settings
from .exceptions import AuthenticationError
from .models.base import Base
from .services.auth_service import AuthService

settings = get_settings()

def _create_sqlite_parent_dirs(database_url: str) -> None:
    """Ensure the parent directory for a SQLite database exists."""

    if database_url.startswith("sqlite") and ":memory:" not in database_url:
        db_path = database_url.split("///")[-1]
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)


_create_sqlite_parent_dirs(settings.database_url)

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine: Engine = create_engine(
    settings.database_url,
    echo=settings.database_echo,
    future=True,
    pool_pre_ping=True,
    connect_args=connect_args,
)

SessionLocal = scoped_session(
    sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False, future=True)
)


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """Provide a transactional scope around a series of operations."""

    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:  # pragma: no cover - re-raise for caller to handle
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a database session per request."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    """Dependency for extracting and validating JWT token from request.
    
    Extracts business_id from valid access token in Authorization header.
    Header format: "Bearer <token>"
    
    Can be disabled via require_auth setting (for testing).
    
    Args:
        authorization: Authorization header value
        
    Returns:
        business_id extracted from token
        
    Raises:
        AuthenticationError: If auth required and token missing/invalid/expired
    """
    settings = get_settings()
    
    # Allow bypassing auth for testing/development
    if not settings.require_auth:
        return "default-business-id"
    
    if not authorization:
        raise AuthenticationError("Missing Authorization header")
    
    # Expected format: "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthenticationError("Invalid Authorization header format. Expected: Bearer <token>")
    
    token = parts[1]
    auth_service = AuthService(settings)
    
    try:
        payload = auth_service.verify_token(token, token_type="access")
        return payload.business_id
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Access token has expired")
    except jwt.InvalidTokenError as e:
        raise AuthenticationError(f"Invalid token: {str(e)}")


@event.listens_for(engine, "connect")
def enforce_sqlite_fk(dbapi_connection, connection_record):  # type: ignore[no-redef]
    """Ensure SQLite foreign keys are enforced when using SQLite backend."""

    if settings.database_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()


def init_database() -> None:
    """Import models and create database tables (for manual setup or tests)."""

    from . import models  # noqa: F401  # Import ensures model metadata is registered.

    Base.metadata.create_all(bind=engine)



@event.listens_for(engine, "connect")
def enforce_sqlite_fk(dbapi_connection, connection_record):  # type: ignore[no-redef]
    """Ensure SQLite foreign keys are enforced when using SQLite backend."""

    if settings.database_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()


def init_database() -> None:
    """Import models and create database tables (for manual setup or tests)."""

    from . import models  # noqa: F401  # Import ensures model metadata is registered.

    Base.metadata.create_all(bind=engine)
