from logging.config import fileConfig

from alembic import context

from backend import models
from backend.core import db

config = context.config
if config.config_file_name and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)


def _run(connection) -> None:
    context.configure(connection=connection, target_metadata=models.Base.metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


if connection := config.attributes.get("connection"):
    _run(connection)
else:
    with db.engine.connect() as conn:
        _run(conn)
