"""initial schema

Revision ID: f8d8bd535452
Revises: 
Create Date: 2026-10-24 10:05:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8d8bd535452'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('courses',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_courses'))
    )
    op.create_table('organization',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('phone', sa.String(length=40), nullable=True),
    sa.Column('address', sa.String(length=500), nullable=True),
    sa.Column('tax_id', sa.String(length=60), nullable=True),
    sa.Column('logo_mime', sa.String(length=40), nullable=True),
    sa.Column('primary_color', sa.String(length=7), nullable=False),
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.Column('locale', sa.String(length=10), nullable=False),
    sa.Column('grace_days', sa.Integer(), nullable=False),
    sa.Column('reminder_template', sa.Text(), nullable=False),
    sa.Column('invoice_prefix', sa.String(length=10), nullable=False),
    sa.Column('invoice_year', sa.Integer(), nullable=False),
    sa.Column('invoice_seq', sa.Integer(), nullable=False),
    sa.Column('backup_enabled', sa.Boolean(), nullable=False),
    sa.Column('backup_cadence', sa.String(length=10), nullable=False),
    sa.Column('backup_keep', sa.Integer(), nullable=False),
    sa.Column('backup_last_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_organization'))
    )
    op.create_table('staff',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('username', sa.String(length=60), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('role', sa.String(length=10), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_staff')),
    sa.UniqueConstraint('username', name=op.f('uq_staff_username'))
    )
    op.create_table('groups',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('course_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('schedule', sa.String(length=200), nullable=True),
    sa.Column('capacity', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], name=op.f('fk_groups_course_id_courses'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_groups'))
    )
    with op.batch_alter_table('groups', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_groups_course_id'), ['course_id'], unique=False)
    op.create_table('plans',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('interval_days', sa.Integer(), nullable=False),
    sa.Column('course_id', sa.Integer(), nullable=True),
    sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], name=op.f('fk_plans_course_id_courses'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_plans'))
    )
    with op.batch_alter_table('plans', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_plans_course_id'), ['course_id'], unique=False)
    op.create_table('members',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('first_name', sa.String(length=100), nullable=False),
    sa.Column('last_name', sa.String(length=100), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('phone', sa.String(length=40), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('course_id', sa.Integer(), nullable=True),
    sa.Column('group_id', sa.Integer(), nullable=True),
    sa.Column('plan_id', sa.Integer(), nullable=True),
    sa.Column('joined_on', sa.Date(), nullable=False),
    sa.Column('paid_until', sa.Date(), nullable=True),
    sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], name=op.f('fk_members_course_id_courses'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['group_id'], ['groups.id'], name=op.f('fk_members_group_id_groups'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['plan_id'], ['plans.id'], name=op.f('fk_members_plan_id_plans'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_members'))
    )
    with op.batch_alter_table('members', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_members_archived_at'), ['archived_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_members_course_id'), ['course_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_members_group_id'), ['group_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_members_last_name'), ['last_name'], unique=False)
        batch_op.create_index(batch_op.f('ix_members_paid_until'), ['paid_until'], unique=False)
        batch_op.create_index(batch_op.f('ix_members_plan_id'), ['plan_id'], unique=False)
    op.create_table('payments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('member_id', sa.Integer(), nullable=False),
    sa.Column('invoice_number', sa.String(length=30), nullable=False),
    sa.Column('description', sa.String(length=200), nullable=False),
    sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('method', sa.String(length=10), nullable=False),
    sa.Column('paid_on', sa.Date(), nullable=False),
    sa.Column('period_start', sa.Date(), nullable=True),
    sa.Column('period_end', sa.Date(), nullable=True),
    sa.Column('notes', sa.String(length=500), nullable=True),
    sa.Column('refunded_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_payments_member_id_members'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_payments')),
    sa.UniqueConstraint('invoice_number', name=op.f('uq_payments_invoice_number'))
    )
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_payments_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_payments_paid_on'), ['paid_on'], unique=False)
    op.create_table('reminders',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('member_id', sa.Integer(), nullable=False),
    sa.Column('staff_id', sa.Integer(), nullable=True),
    sa.Column('channel', sa.String(length=10), nullable=False),
    sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_reminders_member_id_members'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['staff_id'], ['staff.id'], name=op.f('fk_reminders_staff_id_staff'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_reminders'))
    )
    with op.batch_alter_table('reminders', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_reminders_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_reminders_sent_at'), ['sent_at'], unique=False)




def downgrade() -> None:
    """Downgrade schema."""

    with op.batch_alter_table('reminders', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_reminders_sent_at'))
        batch_op.drop_index(batch_op.f('ix_reminders_member_id'))
    op.drop_table('reminders')
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_payments_paid_on'))
        batch_op.drop_index(batch_op.f('ix_payments_member_id'))
    op.drop_table('payments')
    with op.batch_alter_table('members', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_members_plan_id'))
        batch_op.drop_index(batch_op.f('ix_members_paid_until'))
        batch_op.drop_index(batch_op.f('ix_members_last_name'))
        batch_op.drop_index(batch_op.f('ix_members_group_id'))
        batch_op.drop_index(batch_op.f('ix_members_course_id'))
        batch_op.drop_index(batch_op.f('ix_members_archived_at'))
    op.drop_table('members')
    with op.batch_alter_table('plans', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_plans_course_id'))
    op.drop_table('plans')
    with op.batch_alter_table('groups', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_groups_course_id'))
    op.drop_table('groups')
    op.drop_table('staff')
    op.drop_table('organization')
    op.drop_table('courses')

