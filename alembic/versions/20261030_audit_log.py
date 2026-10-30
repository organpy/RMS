"""audit log

Revision ID: bcf2f2047ece
Revises: 4c3edc58ad6d
Create Date: 2026-10-30 09:50:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bcf2f2047ece'
down_revision: Union[str, Sequence[str], None] = '4c3edc58ad6d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('audit_log',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('staff_id', sa.Integer(), nullable=True),
    sa.Column('staff_name', sa.String(length=120), nullable=False),
    sa.Column('action', sa.String(length=20), nullable=False),
    sa.Column('entity', sa.String(length=20), nullable=False),
    sa.Column('entity_id', sa.Integer(), nullable=True),
    sa.Column('summary', sa.String(length=300), nullable=False),
    sa.Column('at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['staff_id'], ['staff.id'], name=op.f('fk_audit_log_staff_id_staff'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_log'))
    )
    with op.batch_alter_table('audit_log', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_audit_log_at'), ['at'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_log_entity'), ['entity'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('audit_log', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_audit_log_entity'))
        batch_op.drop_index(batch_op.f('ix_audit_log_at'))

    op.drop_table('audit_log')
