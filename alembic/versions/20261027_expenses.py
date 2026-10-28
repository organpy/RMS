"""expenses

Revision ID: 4c3edc58ad6d
Revises: e0edf3a161c4
Create Date: 2026-10-27 16:05:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c3edc58ad6d'
down_revision: Union[str, Sequence[str], None] = 'e0edf3a161c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('expenses',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('spent_on', sa.Date(), nullable=False),
    sa.Column('category', sa.String(length=60), nullable=False),
    sa.Column('description', sa.String(length=200), nullable=False),
    sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('method', sa.String(length=10), nullable=False),
    sa.Column('staff_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['staff_id'], ['staff.id'], name=op.f('fk_expenses_staff_id_staff'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_expenses'))
    )
    with op.batch_alter_table('expenses', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_expenses_category'), ['category'], unique=False)
        batch_op.create_index(batch_op.f('ix_expenses_spent_on'), ['spent_on'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('expenses', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_expenses_spent_on'))
        batch_op.drop_index(batch_op.f('ix_expenses_category'))

    op.drop_table('expenses')
