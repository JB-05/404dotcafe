"""menu item unit cost and margin

Revision ID: 007
Revises: 006
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("menu_items", sa.Column("unit_cost", sa.Integer(), server_default="0", nullable=False))
    op.add_column("menu_items", sa.Column("target_margin_pct", sa.Numeric(5, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("menu_items", "target_margin_pct")
    op.drop_column("menu_items", "unit_cost")
