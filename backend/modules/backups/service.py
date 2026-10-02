"""SQLite snapshot backups (db + logo) stored as zip files under ``data/backups``."""

from __future__ import annotations

import json
import os
import re
import sqlite3
import tempfile
import zipfile
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import BinaryIO

from backend.core import db, migrate
from backend.core.config import get_settings
from backend.core.errors import AppError, Conflict, NotFound

NAME = re.compile(r"^rms-\d{8}-\d{6}-(manual|scheduled|pre-restore)\.zip$")


@dataclass
class BackupFile:
    filename: str
    size: int
    kind: str
    created_at: datetime


def _db_path() -> Path:
    url = db.engine.url
    if url.get_backend_name() != "sqlite" or not url.database:
        raise AppError("Backups are only supported for SQLite databases")
    return Path(url.database)


def _dir() -> Path:
    path = get_settings().backups_dir
    path.mkdir(parents=True, exist_ok=True)
    return path


def _describe(path: Path) -> BackupFile:
    stamp, kind = path.stem[4:19], path.stem[20:]
    created = datetime.strptime(stamp, "%Y%m%d-%H%M%S").replace(tzinfo=timezone.utc)
    return BackupFile(filename=path.name, size=path.stat().st_size, kind=kind, created_at=created)


def list_backups() -> list[BackupFile]:
    files = [p for p in _dir().iterdir() if NAME.match(p.name)]
    return sorted((_describe(p) for p in files), key=lambda b: b.created_at, reverse=True)


def resolve(filename: str) -> Path:
    path = _dir() / filename
    if not NAME.match(filename) or not path.exists():
        raise NotFound("Backup not found")
    return path


def create(kind: str = "manual") -> BackupFile:
    source = _db_path()
    now = datetime.now(timezone.utc)
    target = _dir() / f"rms-{now:%Y%m%d-%H%M%S}-{kind}.zip"
    if target.exists():
        raise Conflict("A backup was just created, try again in a second")
    with tempfile.TemporaryDirectory() as tmp:
        snapshot = Path(tmp) / "rms.db"
        with closing(sqlite3.connect(source)) as src, closing(sqlite3.connect(snapshot)) as dst:
            src.backup(dst)
        logo = get_settings().logo_path
        manifest = {"app": "rms", "revision": migrate.head_revision(), "created_at": now.isoformat()}
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(snapshot, "rms.db")
            if logo.exists():
                zf.write(logo, "logo")
            zf.writestr("manifest.json", json.dumps(manifest))
    return _describe(target)


def prune(keep: int, kind: str = "scheduled") -> None:
    for backup in [b for b in list_backups() if b.kind == kind][keep:]:
        (_dir() / backup.filename).unlink(missing_ok=True)


def _validate_db(path: Path) -> None:
    if path.read_bytes()[:16] != b"SQLite format 3\x00":
        raise AppError("Backup does not contain a valid database")
    with closing(sqlite3.connect(path)) as con:
        try:
            revision = con.execute("SELECT version_num FROM alembic_version").fetchone()
            staff = con.execute("SELECT count(*) FROM staff").fetchone()[0]
        except sqlite3.DatabaseError:
            raise AppError("Backup does not contain an RMS database") from None
    if not revision or revision[0] != migrate.head_revision():
        raise AppError("Backup was made with an incompatible version of RMS")
    if not staff:
        raise AppError("Backup contains no staff accounts")


def restore(upload: BinaryIO) -> None:
    """Validate an uploaded archive, snapshot the current state, then swap the database in."""
    limit = get_settings().max_upload_mb * 1024 * 1024
    target = _db_path()
    with tempfile.TemporaryDirectory(dir=target.parent) as tmp:
        archive = Path(tmp) / "upload.zip"
        size = 0
        with archive.open("wb") as out:
            while chunk := upload.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise AppError(f"Backup is larger than {get_settings().max_upload_mb} MB")
                out.write(chunk)
        if not zipfile.is_zipfile(archive):
            raise AppError("Upload is not a zip archive")
        with zipfile.ZipFile(archive) as zf:
            names = set(zf.namelist())
            if "rms.db" not in names or not names <= {"rms.db", "logo", "manifest.json"}:
                raise AppError("Archive is not an RMS backup")
            if sum(i.file_size for i in zf.infolist()) > limit * 4:
                raise AppError("Backup is too large once extracted")
            new_db = Path(tmp) / "rms.db"
            new_db.write_bytes(zf.read("rms.db"))
            logo = zf.read("logo") if "logo" in names else None
        _validate_db(new_db)

        create("pre-restore")
        db.engine.dispose()
        for suffix in ("-wal", "-shm"):
            Path(f"{target}{suffix}").unlink(missing_ok=True)
        os.replace(new_db, target)
        logo_path = get_settings().logo_path
        if logo is None:
            logo_path.unlink(missing_ok=True)
        else:
            logo_path.write_bytes(logo)
