"""add DAILY billing cycle

Revision ID: 008
Revises: 007
"""
from typing import Sequence, Union

from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE billing_cycle ADD VALUE IF NOT EXISTS 'DAILY'")


def downgrade() -> None:
    pass
