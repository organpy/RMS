"""Service to validate and perform backup restore operations safely."""

from __future__ import annotations

import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from zipfile import ZipFile

from sqlalchemy import text
from sqlalchemy.orm import Session


from backend.config import get_settings
from backend.exceptions import ValidationError


class RestoreValidationResult:
    def __init__(self, ok: bool, details: str = "") -> None:
        self.ok = ok
        self.details = details


class RestoreService:
    """Handles validation and execution of restore operations.

    Strategy for SQLite (current default):
    - Accept uploaded zip archive containing a DB dump or CSV exports.
    - Validate presence of expected files (e.g., business.csv) without mutating state.
    - For actual restore: write the uploaded archive to a temp dir, restore into a temp DB file,
      run a schema check (simple SELECT on known tables), then atomically swap files.
    """

    def __init__(self, session: Session, *, settings=None) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.backups_dir = Path(self.settings.scheduled_backup_dir)

    def validate_archive(self, archive_path: Path) -> RestoreValidationResult:
        """Validate archive integrity and expected contents in a dry-run manner."""
        if not archive_path.exists():
            return RestoreValidationResult(False, f"Archive not found: {archive_path}")

        try:
            with ZipFile(archive_path, 'r') as zf:
                names = set(zf.namelist())
                # Expect at least business.csv and members.csv as a minimal check
                required = {"business.csv", "members.csv"}
                missing = required - names
                if missing:
                    return RestoreValidationResult(False, f"Archive missing expected files: {sorted(missing)}")
        except Exception as exc:  # pragma: no cover - defensive
            return RestoreValidationResult(False, f"Invalid zip archive: {exc}")

        return RestoreValidationResult(True, "Archive validated successfully")

    def _ensure_temp_db_path(self) -> Path:
        # Create a temp file path for the restored DB
        tmp_dir = Path(tempfile.mkdtemp(prefix="rms-restore-"))
        return tmp_dir / "app.db"

    def perform_sqlite_swap(self, temp_db_path: Path) -> None:
        """Atomically replace the active SQLite DB file with the provided temp DB file.

        This is done by moving files; existing DB is backed up first.
        """
        active_db = Path(self.settings.database_url.split('///')[-1])
        if not active_db.exists():
            # If no active DB, simply move temp into place
            active_db.parent.mkdir(parents=True, exist_ok=True)
            temp_db_path.replace(active_db)
            return

        backup_path = active_db.with_suffix('.db.bak')
        # Use replace to attempt atomicity on the platform
        active_db.replace(backup_path)
        try:
            temp_db_path.replace(active_db)
        except Exception:  # pragma: no cover - raise after attempting to restore backup
            # try to restore backup
            if backup_path.exists():
                backup_path.replace(active_db)
            raise
        # If success, remove backup
        if backup_path.exists():
            backup_path.unlink(missing_ok=True)

    def restore_from_archive(self, archive_file: bytes, *, dry_run: bool = True) -> RestoreValidationResult:
        """Restore the database from a zip archive bytes.

        If dry_run is True, only validate the archive and simulate steps without changing DB.
        This function is synchronous and performs file/DB operations on the calling thread.
        """
        tmp_dir = Path(tempfile.mkdtemp(prefix="rms-restore-"))
        try:
            archive_path = tmp_dir / f"restore-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.zip"
            # Write archive to temp file
            with open(archive_path, 'wb') as f:
                f.write(archive_file)

            validated = self.validate_archive(archive_path)
            if not validated.ok:
                return validated

            if dry_run:
                return RestoreValidationResult(True, "Dry-run validation passed")

            # For this project we assume CSV-based import is the supported safe path.
            # Implement a simple restore: extract CSVs and re-import into a new temp DB file.
            temp_db = self._ensure_temp_db_path()
            # Create an empty SQLite DB file by copying existing DB schema using SQL dump if available.
            # As a conservative approach, we'll create a new SQLite file and rely on SQLAlchemy to create tables.
            # This is safer than attempting to overwrite in-place until verification completes.
            from sqlalchemy import create_engine

            temp_db.parent.mkdir(parents=True, exist_ok=True)
            engine = create_engine(f"sqlite:///{temp_db}", connect_args={"check_same_thread": False})
            # Create schema
            from backend.models.base import Base

            Base.metadata.create_all(bind=engine)

            # Extract CSVs and import using simple INSERTs in a new connection
            with ZipFile(archive_path, 'r') as zf:
                # Import all CSVs: business, classes, groups, members, payments, receipts
                import csv
                from io import TextIOWrapper

                conn = engine.connect()
                trans = conn.begin()
                try:
                    # Helper to read a CSV into rows
                    def _rows(name: str):
                        if name not in zf.namelist():
                            return []
                        with zf.open(name) as f:
                            reader = csv.DictReader(TextIOWrapper(f, encoding='utf-8-sig'))
                            return list(reader)

                    # Business
                    for row in _rows('business.csv'):
                        stmt = text(
                            "INSERT INTO business (id, name, logo_path, primary_color, secondary_color, language, currency, created_at, updated_at) VALUES (:id, :name, :logo_path, :primary_color, :secondary_color, :language, :currency, :created_at, :updated_at)"
                        )
                        conn.execute(stmt, **row)

                    # Classes
                    for row in _rows('classes.csv'):
                        for k, v in list(row.items()):
                            if v == "":
                                row[k] = None
                        stmt = text(
                            "INSERT INTO class_course (id, business_id, name, description, start_date, end_date, grouping_type, created_at, updated_at) VALUES (:id, :business_id, :name, :description, :start_date, :end_date, :grouping_type, :created_at, :updated_at)"
                        )
                        conn.execute(stmt, **row)

                    # Groups
                    for row in _rows('groups.csv'):
                        for k, v in list(row.items()):
                            if v == "":
                                row[k] = None
                        stmt = text(
                            "INSERT INTO \"group\" (id, class_id, name, description, created_at, updated_at) VALUES (:id, :class_id, :name, :description, :created_at, :updated_at)"
                        )
                        conn.execute(stmt, **row)

                    # Members
                    for row in _rows('members.csv'):
                        for k, v in list(row.items()):
                            if v == "":
                                row[k] = None
                        stmt = text(
                            "INSERT INTO member (id, business_id, class_id, group_id, first_name, last_name, email, phone_number, status, joined_at, archived_at, created_at, updated_at) VALUES (:id, :business_id, :class_id, :group_id, :first_name, :last_name, :email, :phone_number, :status, :joined_at, :archived_at, :created_at, :updated_at)"
                        )
                        conn.execute(stmt, **row)

                    # Payments
                    for row in _rows('payments.csv'):
                        for k, v in list(row.items()):
                            if v == "":
                                row[k] = None
                        stmt = text(
                            "INSERT INTO payment (id, member_id, amount, payment_date, next_due_date, status, method, receipt_number, notes, refunded_at, created_at, updated_at) VALUES (:id, :member_id, :amount, :payment_date, :next_due_date, :status, :method, :receipt_number, :notes, :refunded_at, :created_at, :updated_at)"
                        )
                        conn.execute(stmt, **row)

                    # Receipts
                    for row in _rows('receipts.csv'):
                        for k, v in list(row.items()):
                            if v == "":
                                row[k] = None
                        stmt = text(
                            "INSERT INTO receipt (id, payment_id, file_path, created_at, updated_at) VALUES (:id, :payment_id, :file_path, :created_at, :updated_at)"
                        )
                        conn.execute(stmt, **row)

                    trans.commit()
                except Exception as exc:  # pragma: no cover - ensure rollback and cleanup
                    trans.rollback()
                    raise
                finally:
                    conn.close()

            # Run a basic schema check against temp DB
            from sqlalchemy import create_engine as _create_engine

            check_engine = _create_engine(f"sqlite:///{temp_db}", connect_args={"check_same_thread": False})
            with check_engine.connect() as conn:
                res = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='member';"))
                if res.scalar() is None:
                    raise ValidationError("Restored DB does not contain expected tables")

            # Swap into place
            self.perform_sqlite_swap(temp_db)

            return RestoreValidationResult(True, "Restore completed successfully")
        finally:
            # Cleanup temp dir if exists
            try:
                shutil.rmtree(tmp_dir)
            except Exception:
                pass


__all__ = ["RestoreService", "RestoreValidationResult"]
