"""invoice copies

Revision ID: 38f5b7d3f923
Revises: 1392de0347f9
Create Date: 2026-10-19 09:55:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '38f5b7d3f923'
down_revision: Union[str, Sequence[str], None] = '1392de0347f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('organization', schema=None) as batch_op:
        batch_op.add_column(sa.Column('invoice_note', sa.String(length=300), nullable=True))

    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('recorded_by', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(batch_op.f('fk_payments_recorded_by_staff'), 'staff', ['recorded_by'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_payments_recorded_by_staff'), type_='foreignkey')
        batch_op.drop_column('recorded_by')

    with op.batch_alter_table('organization', schema=None) as batch_op:
        batch_op.drop_column('invoice_note')
