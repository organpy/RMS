"""merge heads

Revision ID: d4e5f6a7b8c9
Revises: 18b99652f77a, c7d8e9f0a1b2
Create Date: 2026-01-22 00:05:00.000000
"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = ("18b99652f77a", "c7d8e9f0a1b2")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
