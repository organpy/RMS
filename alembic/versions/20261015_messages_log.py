"""messages log

Revision ID: 477ae41ed7bd
Revises: f8d8bd535452
Create Date: 2026-10-15 11:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '477ae41ed7bd'
down_revision: Union[str, Sequence[str], None] = 'f8d8bd535452'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('messages',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('member_id', sa.Integer(), nullable=False),
    sa.Column('staff_id', sa.Integer(), nullable=True),
    sa.Column('payment_id', sa.Integer(), nullable=True),
    sa.Column('channel', sa.String(length=10), nullable=False),
    sa.Column('kind', sa.String(length=15), nullable=False),
    sa.Column('recipient', sa.String(length=255), nullable=False),
    sa.Column('subject', sa.String(length=200), nullable=True),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('error', sa.String(length=500), nullable=True),
    sa.Column('period_ref', sa.Date(), nullable=True),
    sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_messages_member_id_members'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], name=op.f('fk_messages_payment_id_payments'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['staff_id'], ['staff.id'], name=op.f('fk_messages_staff_id_staff'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_messages'))
    )
    with op.batch_alter_table('messages', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_messages_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_messages_sent_at'), ['sent_at'], unique=False)

    # Keep the existing reminder log as manual reminder messages.
    op.execute(
        "INSERT INTO messages (member_id, staff_id, channel, kind, recipient, body, status, sent_at) "
        "SELECT member_id, staff_id, channel, 'reminder', '', '', 'manual', sent_at FROM reminders"
    )

    with op.batch_alter_table('reminders', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_reminders_member_id'))
        batch_op.drop_index(batch_op.f('ix_reminders_sent_at'))

    op.drop_table('reminders')


def downgrade() -> None:
    """Downgrade schema."""
    op.create_table('reminders',
    sa.Column('id', sa.INTEGER(), nullable=False),
    sa.Column('member_id', sa.INTEGER(), nullable=False),
    sa.Column('staff_id', sa.INTEGER(), nullable=True),
    sa.Column('channel', sa.VARCHAR(length=10), nullable=False),
    sa.Column('sent_at', sa.DATETIME(), nullable=False),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_reminders_member_id_members'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['staff_id'], ['staff.id'], name=op.f('fk_reminders_staff_id_staff'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_reminders'))
    )
    with op.batch_alter_table('reminders', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_reminders_sent_at'), ['sent_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_reminders_member_id'), ['member_id'], unique=False)

    with op.batch_alter_table('messages', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_messages_sent_at'))
        batch_op.drop_index(batch_op.f('ix_messages_member_id'))

    op.drop_table('messages')
