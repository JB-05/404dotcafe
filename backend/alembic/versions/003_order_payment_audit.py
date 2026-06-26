"""order payment audit fields

Revision ID: 003
Revises: 002
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("paid_at", sa.DateTime(timezone=True)))
    op.add_column("orders", sa.Column("verified_by_user_id", sa.Integer(), sa.ForeignKey("users.id")))


def downgrade() -> None:
    op.drop_column("orders", "verified_by_user_id")
    op.drop_column("orders", "paid_at")
