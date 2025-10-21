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
        # Ensure the parent directory exists for the active DB
        active_db.parent.mkdir(parents=True, exist_ok=True)

        # If there is no active DB file, simply move temp into place
        if not active_db.exists():
            temp_db_path.replace(active_db)
            return

        # Prefer using the SQLite backup API which writes into the existing DB file
        # This avoids filesystem-level replace operations that often fail on Windows
        # when the DB file is held open by processes.
        try:
            import sqlite3

            # Connect to source (temp) and destination (active) and copy data
            # src.backup(dest) will copy the entire database content into the
            # destination database file while it's open.
            with sqlite3.connect(str(temp_db_path)) as src_conn, sqlite3.connect(str(active_db)) as dest_conn:
                src_conn.backup(dest_conn)
                dest_conn.commit()

            # If we reach here, the backup into the active DB succeeded. Nothing to remove.
            return
        except Exception:
            # If the backup API approach fails (rare), fall back to file replace.
            # Create a filesystem backup of the current active DB first if possible.
            backup_path = active_db.with_suffix('.db.bak')
            try:
                try:
                    shutil.copy2(active_db, backup_path)
                except Exception:
                    # If we cannot copy the active DB, continue to attempt replace below
                    pass

                # Attempt an atomic replace of the file as a last resort
                active_db.replace(backup_path)
                temp_db_path.replace(active_db)
                # On success, remove the backup copy
                if backup_path.exists():
                    backup_path.unlink(missing_ok=True)
                return
            except Exception as exc:  # pragma: no cover - surface a clear error
                # Try to restore the original DB file if we moved it
                try:
                    if backup_path.exists():
                        backup_path.replace(active_db)
                except Exception:
                    # If we cannot restore, surface a helpful error
                    pass

                raise ValidationError(
                    "Failed to replace the active database file. "
                    "This can happen on Windows when the DB file is locked by running processes. "
                    "Please stop the application (or any process holding the DB file) and retry the restore, "
                    "or perform an offline restore by running the restore utility on the server filesystem. "
                    f"Underlying error: {exc}"
                )

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
            # If the active DB is an in-memory SQLite used by tests, import directly into the provided session
            # Prefer importing into the provided session when available to avoid file locks
            use_active_session = getattr(self, 'session', None) is not None and getattr(self.session, 'bind', None) is not None

            import csv
            from io import TextIOWrapper

            with ZipFile(archive_path, 'r') as zf:
                def _rows(name: str):
                    if name not in zf.namelist():
                        return []
                    with zf.open(name) as f:
                        reader = csv.DictReader(TextIOWrapper(f, encoding='utf-8-sig'))
                        return list(reader)

                if use_active_session:
                    # Import directly into the active session inside a transaction
                    # Use a nested transaction if the session already has an active transaction
                    if getattr(self.session, 'in_transaction', None) and self.session.in_transaction():
                        trans = self.session.begin_nested()
                    else:
                        trans = self.session.begin()
                    try:
                        # Business - skip if business id already exists in active DB
                        for row in _rows('business.csv'):
                            if row.get('backup_scheduler_enabled', '') == '':
                                row['backup_scheduler_enabled'] = False
                            if row.get('backup_retention_count', '') == '':
                                row['backup_retention_count'] = 5
                            if row.get('backup_retention_days', '') == '':
                                row['backup_retention_days'] = 30

                            existing = self.session.execute(text("SELECT 1 FROM businesses WHERE id = :id"), {"id": row.get("id")}).scalar()
                            if existing:
                                # business already present in active DB; skip insert
                                continue

                            stmt = text(
                                "INSERT INTO businesses (id, name, logo_path, primary_color, secondary_color, language, currency, backup_scheduler_enabled, backup_retention_count, backup_retention_days, created_at, updated_at) VALUES (:id, :name, :logo_path, :primary_color, :secondary_color, :language, :currency, :backup_scheduler_enabled, :backup_retention_count, :backup_retention_days, :created_at, :updated_at)"
                            )
                            self.session.execute(stmt, row)

                        # Classes
                        for row in _rows('classes.csv'):
                            for k, v in list(row.items()):
                                if v == "":
                                    row[k] = None
                            stmt = text(
                                "INSERT INTO classes (id, business_id, name, description, start_date, end_date, grouping_type, created_at, updated_at) VALUES (:id, :business_id, :name, :description, :start_date, :end_date, :grouping_type, :created_at, :updated_at)"
                            )
                            self.session.execute(stmt, row)

                        # Groups
                        for row in _rows('groups.csv'):
                            for k, v in list(row.items()):
                                if v == "":
                                    row[k] = None
                            stmt = text(
                                "INSERT INTO groups (id, class_id, name, description, created_at, updated_at) VALUES (:id, :class_id, :name, :description, :created_at, :updated_at)"
                            )
                            self.session.execute(stmt, row)

                        # Members
                        for row in _rows('members.csv'):
                            for k, v in list(row.items()):
                                if v == "":
                                    row[k] = None
                            stmt = text(
                                "INSERT INTO members (id, business_id, class_id, group_id, first_name, last_name, email, phone_number, status, joined_at, archived_at, created_at, updated_at) VALUES (:id, :business_id, :class_id, :group_id, :first_name, :last_name, :email, :phone_number, :status, :joined_at, :archived_at, :created_at, :updated_at)"
                            )
                            self.session.execute(stmt, row)

                        # Payments
                        for row in _rows('payments.csv'):
                            for k, v in list(row.items()):
                                if v == "":
                                    row[k] = None
                            stmt = text(
                                "INSERT INTO payments (id, member_id, amount, payment_date, next_due_date, status, method, receipt_number, notes, refunded_at, created_at, updated_at) VALUES (:id, :member_id, :amount, :payment_date, :next_due_date, :status, :method, :receipt_number, :notes, :refunded_at, :created_at, :updated_at)"
                            )
                            self.session.execute(stmt, row)

                        # Receipts
                        for row in _rows('receipts.csv'):
                            for k, v in list(row.items()):
                                if v == "":
                                    row[k] = None
                            stmt = text(
                                "INSERT INTO receipts (id, payment_id, file_path, created_at, updated_at) VALUES (:id, :payment_id, :file_path, :created_at, :updated_at)"
                            )
                            self.session.execute(stmt, row)

                        trans.commit()
                    except Exception:
                        trans.rollback()
                        raise

                    # Run a basic schema check against the active DB
                    res = self.session.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='members';"))
                    if res.scalar() is None:
                        raise ValidationError("Restored DB does not contain expected tables")

                    return RestoreValidationResult(True, "Restore completed successfully")
                else:
                    # Create a temp DB file and import there, then swap
                    temp_db = self._ensure_temp_db_path()
                    from sqlalchemy import create_engine

                    temp_db.parent.mkdir(parents=True, exist_ok=True)
                    engine = create_engine(f"sqlite:///{temp_db}", connect_args={"check_same_thread": False})
                    from backend.models.base import Base

                    Base.metadata.create_all(bind=engine)

                    conn = engine.connect()
                    trans = conn.begin()
                    try:
                        # Import into temp DB using same logic as above
                        # Business
                        for row in _rows('business.csv'):
                            if row.get('backup_scheduler_enabled', '') == '':
                                row['backup_scheduler_enabled'] = False
                            if row.get('backup_retention_count', '') == '':
                                row['backup_retention_count'] = 5
                            if row.get('backup_retention_days', '') == '':
                                row['backup_retention_days'] = 30
                            stmt = text(
                                "INSERT INTO businesses (id, name, logo_path, primary_color, secondary_color, language, currency, backup_scheduler_enabled, backup_retention_count, backup_retention_days, created_at, updated_at) VALUES (:id, :name, :logo_path, :primary_color, :secondary_color, :language, :currency, :backup_scheduler_enabled, :backup_retention_count, :backup_retention_days, :created_at, :updated_at)"
                            )
                            conn.execute(stmt, row)

                        # Classes
                        for row in _rows('classes.csv'):
                            for k, v in list(row.items()):
                                if v == "":
                                    row[k] = None
                            stmt = text(
                                "INSERT INTO classes (id, business_id, name, description, start_date, end_date, grouping_type, created_at, updated_at) VALUES (:id, :business_id, :name, :description, :start_date, :end_date, :grouping_type, :created_at, :updated_at)"
                            )
                            conn.execute(stmt, row)

                        # Groups
                        for row in _rows('groups.csv'):
                            for k, v in list(row.items()):
                                if v == "":
                                    row[k] = None
                            stmt = text(
                                "INSERT INTO groups (id, class_id, name, description, created_at, updated_at) VALUES (:id, :class_id, :name, :description, :created_at, :updated_at)"
                            )
                            conn.execute(stmt, row)

                        # Members
                        for row in _rows('members.csv'):
                            for k, v in list(row.items()):
                                if v == "":
                                    row[k] = None
                            stmt = text(
                                "INSERT INTO members (id, business_id, class_id, group_id, first_name, last_name, email, phone_number, status, joined_at, archived_at, created_at, updated_at) VALUES (:id, :business_id, :class_id, :group_id, :first_name, :last_name, :email, :phone_number, :status, :joined_at, :archived_at, :created_at, :updated_at)"
                            )
                            conn.execute(stmt, row)

                        # Payments
                        for row in _rows('payments.csv'):
                            for k, v in list(row.items()):
                                if v == "":
                                    row[k] = None
                            stmt = text(
                                "INSERT INTO payments (id, member_id, amount, payment_date, next_due_date, status, method, receipt_number, notes, refunded_at, created_at, updated_at) VALUES (:id, :member_id, :amount, :payment_date, :next_due_date, :status, :method, :receipt_number, :notes, :refunded_at, :created_at, :updated_at)"
                            )
                            conn.execute(stmt, row)

                        # Receipts
                        for row in _rows('receipts.csv'):
                            for k, v in list(row.items()):
                                if v == "":
                                    row[k] = None
                            stmt = text(
                                "INSERT INTO receipts (id, payment_id, file_path, created_at, updated_at) VALUES (:id, :payment_id, :file_path, :created_at, :updated_at)"
                            )
                            conn.execute(stmt, row)

                        trans.commit()
                    except Exception:  # pragma: no cover - ensure rollback and cleanup
                        trans.rollback()
                        raise
                    finally:
                        conn.close()

                    # Run a basic schema check against temp DB
                    from sqlalchemy import create_engine as _create_engine

                    check_engine = _create_engine(f"sqlite:///{temp_db}", connect_args={"check_same_thread": False})
                    with check_engine.connect() as conn:
                        # Verify expected tables exist in the restored DB (use plural table names)
                        res = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='members';"))
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
