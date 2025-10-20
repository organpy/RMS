"""add backup schedule fields

Revision ID: a1c2d3e4f5ab
Revises: f1a2b3c4d5e6
Create Date: 2025-10-20 10:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.sql import expression


# revision identifiers, used by Alembic.
revision = "a1c2d3e4f5ab"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("businesses")}

    columns_to_add = [
        (
            "backup_scheduler_enabled",
            sa.Column(
                "backup_scheduler_enabled",
                sa.Boolean(),
                nullable=False,
                server_default=expression.false(),
            ),
        ),
        ("backup_cadence", sa.Column("backup_cadence", sa.String(length=20), nullable=True)),
        (
            "backup_retention_count",
            sa.Column(
                "backup_retention_count",
                sa.Integer(),
                nullable=False,
                server_default="5",
            ),
        ),
        ("backup_last_run_at", sa.Column("backup_last_run_at", sa.DateTime(timezone=True), nullable=True)),
        ("backup_next_run_at", sa.Column("backup_next_run_at", sa.DateTime(timezone=True), nullable=True)),
    ]

    for column_name, column in columns_to_add:
        if column_name not in existing_columns:
            op.add_column("businesses", column)
            existing_columns.add(column_name)

    # Normalise defaults for existing rows then drop server defaults for future inserts.
    op.execute("UPDATE businesses SET backup_scheduler_enabled = 0 WHERE backup_scheduler_enabled IS NULL")
    op.execute("UPDATE businesses SET backup_retention_count = 5 WHERE backup_retention_count IS NULL")

    if bind.dialect.name != "sqlite":
        op.alter_column("businesses", "backup_scheduler_enabled", server_default=None)
        op.alter_column("businesses", "backup_retention_count", server_default=None)


def downgrade() -> None:
    op.drop_column("businesses", "backup_next_run_at")
    op.drop_column("businesses", "backup_last_run_at")
    op.drop_column("businesses", "backup_retention_count")
    op.drop_column("businesses", "backup_cadence")
    op.drop_column("businesses", "backup_scheduler_enabled")
