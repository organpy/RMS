"""Database engine, session management, and initialization helpers."""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, scoped_session, sessionmaker

from .config import get_settings
from .models.base import Base

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
