"""orders schema

Revision ID: 002
Revises: 001
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cafe_id", sa.Integer(), sa.ForeignKey("cafes.id"), nullable=False),
        sa.Column("order_number", sa.String(20), nullable=False, unique=True),
        sa.Column("customer_name", sa.String(120), nullable=False),
        sa.Column("customer_phone", sa.String(20)),
        sa.Column("customer_email", sa.String(255)),
        sa.Column("table_number", sa.String(10)),
        sa.Column("notes", sa.Text()),
        sa.Column("subtotal", sa.Integer(), nullable=False),
        sa.Column("cgst", sa.Integer(), nullable=False),
        sa.Column("sgst", sa.Integer(), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column(
            "payment_status",
            sa.Enum("PENDING", "PAID", "CANCELLED", name="payment_status"),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column(
            "order_status",
            sa.Enum(
                "PENDING_PAYMENT",
                "PAID",
                "IN_PREPARATION",
                "READY",
                "COMPLETED",
                "CANCELLED",
                name="order_status",
            ),
            nullable=False,
            server_default="PENDING_PAYMENT",
        ),
        sa.Column("idempotency_key", sa.String(64), unique=True),
        sa.Column("version", sa.Integer(), server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_orders_cafe_id", "orders", ["cafe_id"])
    op.create_index("ix_orders_order_status", "orders", ["order_status"])
    op.create_index("ix_orders_created_at", "orders", ["created_at"])

    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("menu_item_id", sa.Integer(), sa.ForeignKey("menu_items.id")),
        sa.Column("external_id", sa.String(80), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Integer(), nullable=False),
        sa.Column("subtotal", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("customizations", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb")),
    )


def downgrade() -> None:
    op.drop_table("order_items")
    op.drop_table("orders")
    op.execute("DROP TYPE IF EXISTS order_status")
    op.execute("DROP TYPE IF EXISTS payment_status")
