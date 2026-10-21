"""attendance

Revision ID: b6ff61da2eae
Revises: 38f5b7d3f923
Create Date: 2026-10-21 09:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b6ff61da2eae'
down_revision: Union[str, Sequence[str], None] = '38f5b7d3f923'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('sessions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('group_id', sa.Integer(), nullable=False),
    sa.Column('held_on', sa.Date(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['group_id'], ['groups.id'], name=op.f('fk_sessions_group_id_groups'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_sessions')),
    sa.UniqueConstraint('group_id', 'held_on', name=op.f('uq_sessions_group_id'))
    )
    with op.batch_alter_table('sessions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_sessions_group_id'), ['group_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_sessions_held_on'), ['held_on'], unique=False)

    op.create_table('attendance',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('session_id', sa.Integer(), nullable=False),
    sa.Column('member_id', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_attendance_member_id_members'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], name=op.f('fk_attendance_session_id_sessions'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_attendance')),
    sa.UniqueConstraint('session_id', 'member_id', name=op.f('uq_attendance_session_id'))
    )
    with op.batch_alter_table('attendance', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_attendance_member_id'), ['member_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('attendance', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_attendance_member_id'))

    op.drop_table('attendance')
    with op.batch_alter_table('sessions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_sessions_held_on'))
        batch_op.drop_index(batch_op.f('ix_sessions_group_id'))

    op.drop_table('sessions')
