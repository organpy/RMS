"""Application settings and configuration helpers.

These helpers leverage Pydantic's BaseSettings to load environment variables
from the runtime environment. During Phase 0 we only surface the fields needed
by the minimal FastAPI app, but additional configuration options can be added
in Phase 1 as features are implemented.
"""

from functools import lru_cache
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Global application settings loaded from environment variables."""

    app_name: str = Field(default="Registration Management System")
    api_host: str = Field(default="127.0.0.1")
    api_port: int = Field(default=8000)
    database_url: str = Field(default="sqlite:///./data/app.db")
    database_echo: bool = Field(default=False)
    payment_due_interval_days: int = Field(default=30, ge=1)
    payment_inactive_grace_days: int = Field(default=14, ge=0)
    receipt_output_dir: str = Field(default="data/receipts")
    branding_assets_dir: str = Field(default="data/logos")
    scheduled_backup_dir: str = Field(default="data/backups")
    backup_scheduler_poll_seconds: int = Field(default=3600, ge=60)
    cors_allowed_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"],
        description="Origins allowed to access the API via CORS.",
    )

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> list[str] | Any:
        """Allow comma-delimited origin strings in environment configuration."""

        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="",  # Phase 0: no prefix; future phases may add one.
    )


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance so configuration is loaded once."""

    return Settings()
