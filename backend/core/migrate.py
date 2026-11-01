"""Run Alembic migrations programmatically so the app self-upgrades on start."""

from pathlib import Path

from alembic import command
from alembic.config import Config
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


def upgrade(engine: Engine) -> None:
    cfg = _config()
    with engine.begin() as connection:
        cfg.attributes["connection"] = connection
        command.upgrade(cfg, "head")
