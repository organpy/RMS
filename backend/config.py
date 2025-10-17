"""Application settings and configuration helpers.

These helpers leverage Pydantic's BaseSettings to load environment variables
from the runtime environment. During Phase 0 we only surface the fields needed
by the minimal FastAPI app, but additional configuration options can be added
in Phase 1 as features are implemented.
"""

from functools import lru_cache
from pydantic import Field
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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="",  # Phase 0: no prefix; future phases may add one.
    )


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance so configuration is loaded once."""

    return Settings()
