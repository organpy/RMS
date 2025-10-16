"""Application settings and configuration helpers.

These helpers leverage Pydantic's BaseSettings to load environment variables
from the runtime environment. During Phase 0 we only surface the fields needed
by the minimal FastAPI app, but additional configuration options can be added
in Phase 1 as features are implemented.
"""

from functools import lru_cache
from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    """Global application settings loaded from environment variables."""

    app_name: str = Field(default="Registration Management System")
    api_host: str = Field(default="127.0.0.1")
    api_port: int = Field(default=8000)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance so configuration is loaded once."""

    return Settings()
