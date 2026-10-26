"""partial payments

Revision ID: e0edf3a161c4
Revises: abae91f9097f
Create Date: 2026-10-26 09:35:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e0edf3a161c4'
down_revision: Union[str, Sequence[str], None] = 'abae91f9097f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('amount_due', sa.Numeric(precision=10, scale=2), server_default='0', nullable=False))

    # Existing payments were charged exactly what was paid.
    op.execute('UPDATE payments SET amount_due = amount')


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.drop_column('amount_due')
