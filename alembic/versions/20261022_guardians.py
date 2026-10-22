"""guardians

Revision ID: 93fea7413cd9
Revises: b6ff61da2eae
Create Date: 2026-10-22 09:20:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '93fea7413cd9'
down_revision: Union[str, Sequence[str], None] = 'b6ff61da2eae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('members', schema=None) as batch_op:
        batch_op.add_column(sa.Column('guardian_name', sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column('guardian_phone', sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column('guardian_email', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('members', schema=None) as batch_op:
        batch_op.drop_column('guardian_email')
        batch_op.drop_column('guardian_phone')
        batch_op.drop_column('guardian_name')
