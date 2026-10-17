"""auto reminders

Revision ID: 1392de0347f9
Revises: 477ae41ed7bd
Create Date: 2026-10-17 09:40:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '1392de0347f9'
down_revision: Union[str, Sequence[str], None] = '477ae41ed7bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('organization', schema=None) as batch_op:
        batch_op.add_column(sa.Column('auto_remind', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('remind_before_days', sa.Integer(), server_default='3', nullable=False))
        batch_op.add_column(sa.Column('remind_after_days', sa.Integer(), server_default='3', nullable=False))

def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('organization', schema=None) as batch_op:
        batch_op.drop_column('remind_after_days')
        batch_op.drop_column('remind_before_days')
        batch_op.drop_column('auto_remind')

