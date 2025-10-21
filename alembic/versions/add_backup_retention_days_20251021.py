"""add backup_retention_days to businesses

Revision ID: r1s2t3u4v5w6
Revises: m1n2o3p4q5r6
Create Date: 2025-10-21 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'r1s2t3u4v5w6'
down_revision: Union[str, Sequence[str], None] = 'm1n2o3p4q5r6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    inspector = sa.inspect(bind)
    existing_cols = [c['name'] for c in inspector.get_columns('businesses')]
    if 'backup_retention_days' not in existing_cols:
        op.add_column('businesses', sa.Column('backup_retention_days', sa.Integer(), nullable=False, server_default='30'))
        op.execute("UPDATE businesses SET backup_retention_days = 30 WHERE backup_retention_days IS NULL")
    # SQLite doesn't support ALTER COLUMN ... DROP DEFAULT; only attempt on other dialects
        # SQLite doesn't support ALTER COLUMN ... DROP DEFAULT; only attempt on other dialects
        if dialect != 'sqlite':
            op.alter_column('businesses', 'backup_retention_days', server_default=None)


def downgrade() -> None:
    op.drop_column('businesses', 'backup_retention_days')
