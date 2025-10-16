"""Utility helpers for database maintenance and diagnostics."""

from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from .database import SessionLocal, engine


def ping_database() -> bool:
    """Return True if the database responds to a simple SELECT 1 query."""

    session = SessionLocal()
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return False
    else:
        return True
    finally:
        session.close()


def backup_sqlite_database(backup_dir: Path, engine_override: Optional[Engine] = None) -> Path:
    """Create a timestamped backup of the SQLite database file.

    Parameters
    ----------
    backup_dir:
        Directory where the backup copy should be stored.
    engine_override:
        Optional SQLAlchemy engine to use (defaults to the primary engine).

    Returns
    -------
    Path
        The path to the newly created backup file.
    """

    db_engine = engine_override or engine
    url = db_engine.url
    if url.get_backend_name() != "sqlite":  # pragma: no cover - used in SQLite-only scenario
        raise ValueError("Backup utility currently supports SQLite databases only.")

    db_path = Path(url.database or "")
    if not db_path.exists():
        raise FileNotFoundError(f"Database file not found at {db_path}")

    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    backup_path = backup_dir / f"backup-{timestamp}.db"
    shutil.copy2(db_path, backup_path)
    return backup_path
