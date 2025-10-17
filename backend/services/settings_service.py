"""Service for managing business branding and configuration settings."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from sqlalchemy.orm import Session

from backend.config import Settings, get_settings
from backend.crud import BusinessCRUD
from backend.exceptions import ValidationError
from backend.models import Business
from backend.schemas.settings import BusinessSettingsCreate

_ALLOWED_LOGO_EXTENSIONS = {".png", ".jpg", ".jpeg", ".svg", ".webp"}


@dataclass(frozen=True)
class BackupConfiguration:
    """Data structure describing the backup payload for settings export."""

    business: Business
    environment: dict[str, Any]


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
        }
        return BackupConfiguration(business=business, environment=environment)

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


__all__ = ["SettingsService", "BackupConfiguration"]
