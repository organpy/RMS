"""onboarding checklist

Revision ID: 7d1e0a9c4b21
Revises: bcf2f2047ece
Create Date: 2026-11-06 10:05:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7d1e0a9c4b21'
down_revision: Union[str, Sequence[str], None] = 'bcf2f2047ece'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('organization', schema=None) as batch_op:
        batch_op.add_column(sa.Column('onboarding_dismissed', sa.Boolean(), server_default='0', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('organization', schema=None) as batch_op:
        batch_op.drop_column('onboarding_dismissed')
