"""Schemas for system configuration and branding settings."""

from __future__ import annotations

import re
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .common import TimestampedSchema

_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


class BackupCadence(str, Enum):
    """Supported automated backup cadences."""

    DAILY = "daily"
    WEEKLY = "weekly"


class BusinessSettingsBase(BaseModel):
    """Shared fields for business branding settings."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    primary_color: str | None = Field(default=None)
    secondary_color: str | None = Field(default=None)
    language: str = Field(default="EN", min_length=2, max_length=5)
    currency: str = Field(default="USD", min_length=3, max_length=3)

    @field_validator("primary_color", "secondary_color")
    @classmethod
    def _validate_hex_color(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not _HEX_COLOR.match(value):
            raise ValueError("Color must be a 6-digit hex value (e.g., #AABBCC).")
        return value.upper()


class BusinessSettingsCreate(BusinessSettingsBase):
    """Schema used internally when ensuring a default business row exists."""

    backup_scheduler_enabled: bool = False
    backup_retention_count: int = Field(default=5, ge=1, le=60)
    backup_retention_days: int = Field(default=30, ge=1)


class BusinessSettingsUpdate(BaseModel):
    """Payload for updating business branding settings."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    primary_color: str | None = None
    secondary_color: str | None = None
    language: str | None = Field(default=None, min_length=2, max_length=5)
    currency: str | None = Field(default=None, min_length=3, max_length=3)

    @field_validator("primary_color", "secondary_color")
    @classmethod
    def _validate_hex_color(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not _HEX_COLOR.match(value):
            raise ValueError("Color must be a 6-digit hex value (e.g., #AABBCC).")
        return value.upper()

    @model_validator(mode="after")
    def _ensure_payload_has_values(self) -> "BusinessSettingsUpdate":
        if not any(value is not None for value in self.model_dump().values()):
            raise ValueError("At least one field must be provided for update.")
        return self


class BusinessSettingsResponse(TimestampedSchema):
    """Response payload describing the current business settings."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    primary_color: str | None = None
    secondary_color: str | None = None
    language: str
    currency: str
    logo_path: str | None = None
    backup_scheduler_enabled: bool
    backup_cadence: BackupCadence | None = None
    backup_retention_count: int
    backup_retention_days: int
    backup_last_run_at: datetime | None = None
    backup_next_run_at: datetime | None = None


class BackupEnvironmentSchema(BaseModel):
    """Environment-level configuration relevant for backups."""

    model_config = ConfigDict(extra="forbid")

    app_name: str
    api_host: str
    api_port: int
    database_url: str
    receipt_output_dir: str
    branding_assets_dir: str
    payment_due_interval_days: int
    payment_inactive_grace_days: int
    scheduled_backup_dir: str
    backup_scheduler_poll_seconds: int


class BackupConfigResponse(BaseModel):
    """Aggregated payload used when exporting backup configuration."""

    model_config = ConfigDict(extra="forbid")

    business: BusinessSettingsResponse
    environment: BackupEnvironmentSchema


class BackupScheduleUpdate(BaseModel):
    """Payload for updating automated backup settings."""

    model_config = ConfigDict(extra="forbid")

    enabled: bool = Field(default=False)
    cadence: BackupCadence | None = Field(default=None)
    retention_count: int = Field(default=5, ge=1, le=60)
    retention_days: int = Field(default=30, ge=1)

    @model_validator(mode="after")
    def _validate_payload(self) -> "BackupScheduleUpdate":
        if self.enabled and self.cadence is None:
            raise ValueError("Cadence is required when automation is enabled.")
        return self


__all__ = [
    "BusinessSettingsCreate",
    "BusinessSettingsUpdate",
    "BusinessSettingsResponse",
    "BackupEnvironmentSchema",
    "BackupConfigResponse",
    "BackupCadence",
    "BackupScheduleUpdate",
]
