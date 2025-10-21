"""merge heads

Revision ID: m1n2o3p4q5r6
Revises: a1b2c3d4e5f6, b7c8d9e0f1ab
Create Date: 2025-10-21 11:05:00.000000

This is a merge revision to combine two parallel heads so `alembic upgrade head` works.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'm1n2o3p4q5r6'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f6', 'b7c8d9e0f1ab')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # merge revision: no schema changes
    pass


def downgrade() -> None:
    pass
