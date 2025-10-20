"""add payment reminder tables

Revision ID: b7c8d9e0f1ab
Revises: a1c2d3e4f5ab
Create Date: 2025-10-20 15:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "b7c8d9e0f1ab"
down_revision = "a1c2d3e4f5ab"
branch_labels = None
depends_on = None


reminder_status_enum = sa.Enum("idle", "queued", "sent", name="reminder_status")
reminder_attempt_result_enum = sa.Enum("queued", "skipped", "completed", name="reminder_attempt_result")


def upgrade() -> None:
    bind = op.get_bind()
    reminder_status_enum.create(bind, checkfirst=True)
    reminder_attempt_result_enum.create(bind, checkfirst=True)

    inspector = inspect(bind)
    if not inspector.has_table("payment_reminders"):
        op.create_table(
            "payment_reminders",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "payment_id",
                sa.Integer(),
                sa.ForeignKey("payments.id", ondelete="CASCADE"),
                nullable=False,
                unique=True,
            ),
            sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False),
            sa.Column("status", reminder_status_enum, nullable=False, server_default="idle"),
            sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("next_scheduled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    inspector = inspect(bind)
    if not inspector.has_table("payment_reminder_logs"):
        op.create_table(
            "payment_reminder_logs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "reminder_id",
                sa.Integer(),
                sa.ForeignKey("payment_reminders.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("payment_id", sa.Integer(), sa.ForeignKey("payments.id", ondelete="CASCADE"), nullable=False),
            sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False),
            sa.Column("attempted_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
            sa.Column("result", reminder_attempt_result_enum, nullable=False, server_default="queued"),
            sa.Column("note", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    inspector = inspect(bind)
    if inspector.has_table("payment_reminder_logs"):
        existing_indexes = {index["name"] for index in inspector.get_indexes("payment_reminder_logs")}
        if "ix_payment_reminder_logs_reminder_id" not in existing_indexes:
            op.create_index("ix_payment_reminder_logs_reminder_id", "payment_reminder_logs", ["reminder_id"])
        if "ix_payment_reminder_logs_payment_id" not in existing_indexes:
            op.create_index("ix_payment_reminder_logs_payment_id", "payment_reminder_logs", ["payment_id"])

    if bind.dialect.name != "sqlite":
        op.alter_column("payment_reminders", "status", server_default=None)
        op.alter_column("payment_reminders", "attempt_count", server_default=None)
        op.alter_column("payment_reminder_logs", "result", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_payment_reminder_logs_payment_id", table_name="payment_reminder_logs")
    op.drop_index("ix_payment_reminder_logs_reminder_id", table_name="payment_reminder_logs")
    op.drop_table("payment_reminder_logs")
    op.drop_table("payment_reminders")

    reminder_attempt_result_enum.drop(op.get_bind(), checkfirst=True)
    reminder_status_enum.drop(op.get_bind(), checkfirst=True)
