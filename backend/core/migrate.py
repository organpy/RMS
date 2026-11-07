"""Run Alembic migrations programmatically so the app self-upgrades on start."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Engine

ROOT = Path(__file__).resolve().parents[2]


def _config() -> Config:
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    cfg.attributes["configure_logger"] = False
    return cfg


def head_revision() -> str:
    return ScriptDirectory.from_config(_config()).get_current_head()


def known_revisions() -> set[str]:
    return {r.revision for r in ScriptDirectory.from_config(_config()).walk_revisions()}


def current_revision(engine: Engine) -> str | None:
    """Schema revision of the database, or None for a brand-new one."""
    with engine.connect() as connection:
        return MigrationContext.configure(connection).get_current_revision()


def app_version() -> str:
    """Release version written by ``scripts/package.py``; ``dev`` when running from source."""
    path = ROOT / "VERSION"
    return path.read_text().strip() if path.exists() else "dev"


def upgrade(engine: Engine) -> None:
    cfg = _config()
    with engine.begin() as connection:
        cfg.attributes["connection"] = connection
        command.upgrade(cfg, "head")
