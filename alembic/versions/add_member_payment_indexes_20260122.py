"""add member/payment indexes

Revision ID: c7d8e9f0a1b2
Revises: m1n2o3p4q5r6
Create Date: 2026-01-22 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, Sequence[str], None] = "m1n2o3p4q5r6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_members_business_id", "members", ["business_id"])
    op.create_index("ix_members_status", "members", ["status"])
    op.create_index("ix_members_class_id", "members", ["class_id"])
    op.create_index("ix_members_group_id", "members", ["group_id"])
    op.create_index("ix_members_archived_at", "members", ["archived_at"])

    op.create_index("ix_payments_member_id", "payments", ["member_id"])
    op.create_index("ix_payments_status", "payments", ["status"])
    op.create_index("ix_payments_method", "payments", ["method"])
    op.create_index("ix_payments_payment_date", "payments", ["payment_date"])
    op.create_index("ix_payments_next_due_date", "payments", ["next_due_date"])


def downgrade() -> None:
    op.drop_index("ix_payments_next_due_date", table_name="payments")
    op.drop_index("ix_payments_payment_date", table_name="payments")
    op.drop_index("ix_payments_method", table_name="payments")
    op.drop_index("ix_payments_status", table_name="payments")
    op.drop_index("ix_payments_member_id", table_name="payments")

    op.drop_index("ix_members_archived_at", table_name="members")
    op.drop_index("ix_members_group_id", table_name="members")
    op.drop_index("ix_members_class_id", table_name="members")
    op.drop_index("ix_members_status", table_name="members")
    op.drop_index("ix_members_business_id", table_name="members")
