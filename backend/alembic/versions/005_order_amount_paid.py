"""order payment tracking

Revision ID: 005
Revises: 004
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("amount_paid", sa.Integer(), server_default="0", nullable=False))
    op.add_column(
        "order_items",
        sa.Column("stock_deducted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.execute(
        """
        UPDATE orders SET amount_paid = total
        WHERE payment_status = 'PAID' OR order_status IN ('PAID', 'IN_PREPARATION', 'READY', 'COMPLETED')
        """
    )
    op.execute("UPDATE order_items SET stock_deducted = true WHERE order_id IN (SELECT id FROM orders WHERE amount_paid > 0)")


def downgrade() -> None:
    op.drop_column("order_items", "stock_deducted")
    op.drop_column("orders", "amount_paid")
