"""order number unique per cafe per IST day

Revision ID: 010
Revises: 009
"""
from typing import Sequence, Union

from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("orders_order_number_key", "orders", type_="unique")
    op.execute(
        """
        CREATE UNIQUE INDEX uq_orders_cafe_ist_day_number
        ON orders (
            cafe_id,
            ((created_at AT TIME ZONE 'Asia/Kolkata')::date),
            order_number
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_orders_cafe_ist_day_number")
    op.create_unique_constraint("orders_order_number_key", "orders", ["order_number"])
