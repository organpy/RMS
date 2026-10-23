"""discounts

Revision ID: abae91f9097f
Revises: 93fea7413cd9
Create Date: 2026-10-23 09:45:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'abae91f9097f'
down_revision: Union[str, Sequence[str], None] = '93fea7413cd9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('members', schema=None) as batch_op:
        batch_op.add_column(sa.Column('discount_percent', sa.Numeric(precision=5, scale=2), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('members', schema=None) as batch_op:
        batch_op.drop_column('discount_percent')
