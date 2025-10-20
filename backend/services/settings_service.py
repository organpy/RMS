"""Service for managing business branding and configuration settings."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from io import BytesIO, StringIO
from pathlib import Path
from typing import Any, Callable, Iterable
from zipfile import ZIP_DEFLATED, ZipFile

from sqlalchemy.orm import Session

from backend.config import Settings, get_settings
from backend.crud import BusinessCRUD
from backend.exceptions import ValidationError
from backend.models import Business, ClassCourse, Group, Member, Payment, Receipt
from backend.schemas.settings import BackupCadence, BackupScheduleUpdate, BusinessSettingsCreate

_ALLOWED_LOGO_EXTENSIONS = {".png", ".jpg", ".jpeg", ".svg", ".webp"}


@dataclass(frozen=True)
class BackupConfiguration:
    """Data structure describing the backup payload for settings export."""

    business: Business
    environment: dict[str, Any]


@dataclass(frozen=True)
class BackupArchive:
    """Binary payload containing a zipped CSV export of core entities."""

    filename: str
    content: bytes
    generated_at: datetime


class SettingsService:
    """Coordinate persistence and storage concerns for system settings."""

    def __init__(
        self,
        session: Session,
        *,
        settings: Settings | None = None,
        assets_dir: Path | str | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.assets_dir = Path(assets_dir or self.settings.branding_assets_dir)
        self.backups_dir = Path(self.settings.scheduled_backup_dir)
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self._crud = BusinessCRUD(session)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def get_business(self) -> Business:
        """Return the primary business row, creating a default if missing."""

        business = self._crud.get_primary()
        if business is None:
            payload = BusinessSettingsCreate(name=self.settings.app_name).model_dump()
            business = self._crud.create(payload)
        return business

    def update_business(self, payload: dict[str, Any]) -> Business:
        """Update business branding settings with the provided payload."""

        business = self.get_business()
        if not payload:
            return business
        # Filter only fields that exist on the Business model.
        allowed_fields = {"name", "primary_color", "secondary_color", "language", "currency"}
        update_data = {field: value for field, value in payload.items() if field in allowed_fields}
        if not update_data:
            return business
        return self._crud.update(business, update_data)

    def store_logo(self, *, filename: str, content: bytes) -> Business:
        """Persist an uploaded logo to disk and update the business record."""

        if not content:
            raise ValidationError("Uploaded logo file is empty.")

        extension = Path(filename).suffix.lower()
        if extension not in _ALLOWED_LOGO_EXTENSIONS:
            raise ValidationError("Logo must be one of: png, jpg, jpeg, svg, webp.")

        business = self.get_business()
        safe_name = self._build_logo_filename(business.name, extension)
        self.assets_dir.mkdir(parents=True, exist_ok=True)
        target_path = self.assets_dir / safe_name
        target_path.write_bytes(content)

        # Remove old logo to avoid storage leaks.
        if business.logo_path:
            old_path = Path(business.logo_path)
            if old_path.exists() and old_path != target_path:
                old_path.unlink(missing_ok=True)

        return self._crud.update(business, {"logo_path": str(target_path)})

    def generate_backup_configuration(self) -> BackupConfiguration:
        """Return the backing data needed for backup configuration exports."""

        business = self.get_business()
        environment = {
            "app_name": self.settings.app_name,
            "api_host": self.settings.api_host,
            "api_port": self.settings.api_port,
            "database_url": self.settings.database_url,
            "receipt_output_dir": self.settings.receipt_output_dir,
            "branding_assets_dir": str(self.assets_dir),
            "payment_due_interval_days": self.settings.payment_due_interval_days,
            "payment_inactive_grace_days": self.settings.payment_inactive_grace_days,
            "scheduled_backup_dir": self.backups_dir.as_posix(),
            "backup_scheduler_poll_seconds": self.settings.backup_scheduler_poll_seconds,
        }
        return BackupConfiguration(business=business, environment=environment)

    def update_backup_schedule(self, payload: BackupScheduleUpdate) -> Business:
        """Persist automated backup schedule preferences."""

        business = self.get_business()
        update_data: dict[str, Any] = {
            "backup_scheduler_enabled": payload.enabled,
            "backup_retention_count": payload.retention_count,
        }
        if payload.enabled and payload.cadence:
            cadence_value = payload.cadence.value
            update_data["backup_cadence"] = cadence_value
            reference = business.backup_last_run_at or self.clock()
            if reference.tzinfo is None:
                reference = reference.replace(tzinfo=timezone.utc)
            update_data["backup_next_run_at"] = self.calculate_next_run(reference, payload.cadence)
        else:
            update_data["backup_cadence"] = None
            update_data["backup_next_run_at"] = None
        updated = self._crud.update(business, update_data)
        return self._normalize_backup_timestamps(updated)

    def finalize_scheduled_backup(self, run_at: datetime, cadence: BackupCadence | None) -> Business:
        """Record metadata after a scheduled backup finishes."""

        business = self.get_business()
        aware_run_at = run_at if run_at.tzinfo else run_at.replace(tzinfo=timezone.utc)
        aware_run_at = aware_run_at.astimezone(timezone.utc)
        next_run = self.calculate_next_run(aware_run_at, cadence) if cadence else None
        business = self._crud.update(
            business,
            {
                "backup_last_run_at": aware_run_at,
                "backup_next_run_at": next_run,
            },
        )
        return self._normalize_backup_timestamps(business)

    def generate_backup_archive(self) -> BackupArchive:
        """Produce a zipped archive with CSV exports for core entities."""

        timestamp = self.clock()
        business = self.get_business()
        archive_name = f"{self._slugify_business_name(business.name)}-backup-{timestamp.strftime('%Y%m%d%H%M%S')}.zip"

        zip_buffer = BytesIO()
        with ZipFile(zip_buffer, mode="w", compression=ZIP_DEFLATED) as archive:
            archive.writestr("business.csv", self._build_business_csv(business))
            archive.writestr("classes.csv", self._build_classes_csv())
            archive.writestr("groups.csv", self._build_groups_csv())
            archive.writestr("members.csv", self._build_members_csv())
            archive.writestr("payments.csv", self._build_payments_csv())
            archive.writestr("receipts.csv", self._build_receipts_csv())

        zip_buffer.seek(0)
        return BackupArchive(filename=archive_name, content=zip_buffer.getvalue(), generated_at=timestamp)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _build_logo_filename(self, business_name: str, extension: str) -> str:
        normalized = business_name.lower()
        sanitized = "".join(ch if ch.isalnum() else "-" for ch in normalized)
        while "--" in sanitized:
            sanitized = sanitized.replace("--", "-")
        slug = sanitized.strip("-") or "business"
        timestamp = self.clock().strftime("%Y%m%d%H%M%S")
        return f"{slug}-{timestamp}{extension}"

    def _slugify_business_name(self, business_name: str) -> str:
        normalized = business_name.lower()
        sanitized = "".join(ch if ch.isalnum() else "-" for ch in normalized)
        while "--" in sanitized:
            sanitized = sanitized.replace("--", "-")
        return sanitized.strip("-") or "business"

    def _build_business_csv(self, business: Business) -> str:
        headers = [
            "id",
            "name",
            "logo_path",
            "primary_color",
            "secondary_color",
            "language",
            "currency",
            "created_at",
            "updated_at",
        ]
        rows = [
            [
                business.id,
                business.name,
                business.logo_path or "",
                business.primary_color or "",
                business.secondary_color or "",
                business.language,
                business.currency,
                self._serialize_datetime(business.created_at),
                self._serialize_datetime(business.updated_at),
            ]
        ]
        return self._rows_to_csv(headers, rows)

    def calculate_next_run(
        self, reference: datetime, cadence: BackupCadence | None
    ) -> datetime | None:
        if cadence is None:
            return None
        base = reference.astimezone(timezone.utc)
        if cadence == BackupCadence.DAILY:
            return base + timedelta(days=1)
        if cadence == BackupCadence.WEEKLY:
            return base + timedelta(days=7)
        raise ValueError(f"Unsupported cadence: {cadence}")

    def prune_backup_archives(self, retention_count: int) -> None:
        """Remove old scheduled backup archives exceeding retention."""

        retention = max(1, retention_count)
        if not self.backups_dir.exists():
            return
        archives = sorted(self.backups_dir.glob("*.zip"), key=lambda path: path.stat().st_mtime, reverse=True)
        for stale in archives[retention:]:
            stale.unlink(missing_ok=True)

    def _build_classes_csv(self) -> str:
        classes = self.session.query(ClassCourse).order_by(ClassCourse.id).all()
        headers = [
            "id",
            "business_id",
            "name",
            "description",
            "start_date",
            "end_date",
            "grouping_type",
            "created_at",
            "updated_at",
        ]
        rows = [
            [
                class_course.id,
                class_course.business_id,
                class_course.name,
                class_course.description or "",
                self._serialize_date(class_course.start_date),
                self._serialize_date(class_course.end_date),
                class_course.grouping_type or "",
                self._serialize_datetime(class_course.created_at),
                self._serialize_datetime(class_course.updated_at),
            ]
            for class_course in classes
        ]
        return self._rows_to_csv(headers, rows)

    def _build_groups_csv(self) -> str:
        groups = self.session.query(Group).order_by(Group.id).all()
        headers = [
            "id",
            "class_id",
            "name",
            "description",
            "created_at",
            "updated_at",
        ]
        rows = [
            [
                group.id,
                group.class_id,
                group.name,
                group.description or "",
                self._serialize_datetime(group.created_at),
                self._serialize_datetime(group.updated_at),
            ]
            for group in groups
        ]
        return self._rows_to_csv(headers, rows)

    def _build_members_csv(self) -> str:
        members = self.session.query(Member).order_by(Member.id).all()
        headers = [
            "id",
            "business_id",
            "class_id",
            "group_id",
            "first_name",
            "last_name",
            "email",
            "phone_number",
            "status",
            "joined_at",
            "archived_at",
            "created_at",
            "updated_at",
        ]
        rows = [
            [
                member.id,
                member.business_id,
                member.class_id or "",
                member.group_id or "",
                member.first_name,
                member.last_name,
                member.email or "",
                member.phone_number or "",
                member.status.value if member.status else "",
                self._serialize_date(member.joined_at),
                self._serialize_datetime(member.archived_at),
                self._serialize_datetime(member.created_at),
                self._serialize_datetime(member.updated_at),
            ]
            for member in members
        ]
        return self._rows_to_csv(headers, rows)

    def _build_payments_csv(self) -> str:
        payments = self.session.query(Payment).order_by(Payment.id).all()
        headers = [
            "id",
            "member_id",
            "amount",
            "payment_date",
            "next_due_date",
            "status",
            "method",
            "receipt_number",
            "notes",
            "refunded_at",
            "created_at",
            "updated_at",
        ]
        rows = [
            [
                payment.id,
                payment.member_id,
                self._format_amount(payment.amount),
                self._serialize_date(payment.payment_date),
                self._serialize_date(payment.next_due_date),
                payment.status.value if payment.status else "",
                payment.method.value if payment.method else "",
                payment.receipt_number or "",
                payment.notes or "",
                self._serialize_datetime(payment.refunded_at),
                self._serialize_datetime(payment.created_at),
                self._serialize_datetime(payment.updated_at),
            ]
            for payment in payments
        ]
        return self._rows_to_csv(headers, rows)

    def _build_receipts_csv(self) -> str:
        receipts = self.session.query(Receipt).order_by(Receipt.id).all()
        headers = [
            "id",
            "payment_id",
            "file_path",
            "created_at",
            "updated_at",
        ]
        rows = [
            [
                receipt.id,
                receipt.payment_id,
                receipt.file_path,
                self._serialize_datetime(receipt.created_at),
                self._serialize_datetime(receipt.updated_at),
            ]
            for receipt in receipts
        ]
        return self._rows_to_csv(headers, rows)

    def _rows_to_csv(self, headers: list[str], rows: Iterable[Iterable[Any]]) -> str:
        buffer = StringIO()
        writer = csv.writer(buffer)
        writer.writerow(headers)
        for row in rows:
            writer.writerow([self._stringify(value) for value in row])
        buffer.seek(0)
        return "\ufeff" + buffer.read()

    @staticmethod
    def _normalize_backup_timestamps(business: Business) -> Business:
        if business.backup_last_run_at and business.backup_last_run_at.tzinfo is None:
            business.backup_last_run_at = business.backup_last_run_at.replace(tzinfo=timezone.utc)
        if business.backup_last_run_at and business.backup_last_run_at.tzinfo is not None:
            business.backup_last_run_at = business.backup_last_run_at.astimezone(timezone.utc)
        if business.backup_next_run_at and business.backup_next_run_at.tzinfo is None:
            business.backup_next_run_at = business.backup_next_run_at.replace(tzinfo=timezone.utc)
        if business.backup_next_run_at and business.backup_next_run_at.tzinfo is not None:
            business.backup_next_run_at = business.backup_next_run_at.astimezone(timezone.utc)
        return business

    @staticmethod
    def _stringify(value: Any) -> Any:
        if value is None:
            return ""
        if isinstance(value, Decimal):
            return format(value, "f")
        if isinstance(value, float):
            return f"{value:.2f}"
        return value

    @staticmethod
    def _format_amount(value) -> str:
        if value is None:
            return ""
        if isinstance(value, Decimal):
            return format(value, ".2f")
        try:
            return f"{float(value):.2f}"
        except (TypeError, ValueError):  # pragma: no cover - defensive
            return str(value)

    @staticmethod
    def _serialize_date(value) -> str:
        if not value:
            return ""
        return value.isoformat()

    @staticmethod
    def _serialize_datetime(value) -> str:
        if not value:
            return ""
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)


__all__ = ["SettingsService", "BackupConfiguration", "BackupArchive"]
