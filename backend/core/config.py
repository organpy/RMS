"""Application settings, loaded from environment variables (prefix ``RMS_``) or ``.env``."""

from __future__ import annotations

import secrets
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RMS_", env_file=".env", extra="ignore")

    app_name: str = "RMS"
    host: str = "127.0.0.1"
    port: int = 8000
    data_dir: Path = Path("data")
    database_url: str = ""
    secret_key: str = ""
    secure_cookies: bool = False
    session_hours: int = Field(default=12, ge=1)
    max_upload_mb: int = Field(default=100, ge=1)

    # Messaging providers (all optional; a channel is enabled once its settings are present).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_security: Literal["starttls", "ssl", "none"] = "starttls"
    twilio_sid: str = ""
    twilio_token: str = ""
    twilio_sms_from: str = ""
    twilio_whatsapp_from: str = ""

    @property
    def db_url(self) -> str:
        return self.database_url or f"sqlite:///{(self.data_dir / 'rms.db').as_posix()}"

    @property
    def backups_dir(self) -> Path:
        return self.data_dir / "backups"

    @property
    def logo_path(self) -> Path:
        return self.data_dir / "logo"

    def jwt_secret(self) -> str:
        """Return the configured secret, or a persistent one generated on first use."""
        if self.secret_key:
            return self.secret_key
        key_file = self.data_dir / "secret.key"
        if not key_file.exists():
            key_file.parent.mkdir(parents=True, exist_ok=True)
            key_file.write_text(secrets.token_urlsafe(48))
            key_file.chmod(0o600)
        self.secret_key = key_file.read_text().strip()
        return self.secret_key


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    return settings
