"""inventory and finance schema

Revision ID: 004
Revises: 003
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "inventory_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cafe_id", sa.Integer(), sa.ForeignKey("cafes.id"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column(
            "unit",
            sa.Enum("kg", "g", "pcs", "ml", "l", name="stock_unit"),
            nullable=False,
        ),
        sa.Column("current_stock", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("threshold", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("cost_per_unit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_inventory_items_cafe_id", "inventory_items", ["cafe_id"])

    op.create_table(
        "menu_item_recipes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "menu_item_id",
            sa.Integer(),
            sa.ForeignKey("menu_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "inventory_item_id",
            sa.Integer(),
            sa.ForeignKey("inventory_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quantity_required", sa.Numeric(12, 3), nullable=False),
    )
    op.create_index("ix_menu_item_recipes_menu_item_id", "menu_item_recipes", ["menu_item_id"])
    op.create_index(
        "ix_menu_item_recipes_inventory_item_id", "menu_item_recipes", ["inventory_item_id"]
    )

    op.create_table(
        "stock_movements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cafe_id", sa.Integer(), sa.ForeignKey("cafes.id"), nullable=False),
        sa.Column(
            "inventory_item_id",
            sa.Integer(),
            sa.ForeignKey("inventory_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quantity_change", sa.Numeric(12, 3), nullable=False),
        sa.Column(
            "reason",
            sa.Enum(
                "ORDER_FULFILLMENT",
                "RESTOCK",
                "SPOILAGE",
                "DAMAGE",
                "CORRECTION",
                name="stock_movement_reason",
            ),
            nullable=False,
        ),
        sa.Column("reference_order_id", sa.Integer(), sa.ForeignKey("orders.id")),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_stock_movements_cafe_id", "stock_movements", ["cafe_id"])
    op.create_index("ix_stock_movements_inventory_item_id", "stock_movements", ["inventory_item_id"])
    op.create_index("ix_stock_movements_created_at", "stock_movements", ["created_at"])

    op.create_table(
        "fixed_expenses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cafe_id", sa.Integer(), sa.ForeignKey("cafes.id"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column(
            "billing_cycle",
            sa.Enum("MONTHLY", "YEARLY", name="billing_cycle"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_fixed_expenses_cafe_id", "fixed_expenses", ["cafe_id"])

    op.create_table(
        "variable_expenses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cafe_id", sa.Integer(), sa.ForeignKey("cafes.id"), nullable=False),
        sa.Column("expense_date", sa.Date(), nullable=False),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_variable_expenses_cafe_id", "variable_expenses", ["cafe_id"])
    op.create_index("ix_variable_expenses_expense_date", "variable_expenses", ["expense_date"])

    op.create_table(
        "daily_financial_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cafe_id", sa.Integer(), sa.ForeignKey("cafes.id"), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("revenue", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cogs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fixed_expenses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("variable_expenses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("gross_profit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("net_profit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("profit_margin_pct", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("order_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_daily_snapshots_cafe_id", "daily_financial_snapshots", ["cafe_id"])
    op.create_index("ix_daily_snapshots_date", "daily_financial_snapshots", ["snapshot_date"])
    op.create_unique_constraint(
        "uq_daily_snapshot_cafe_date", "daily_financial_snapshots", ["cafe_id", "snapshot_date"]
    )


def downgrade() -> None:
    op.drop_table("daily_financial_snapshots")
    op.drop_table("variable_expenses")
    op.drop_table("fixed_expenses")
    op.drop_table("stock_movements")
    op.drop_table("menu_item_recipes")
    op.drop_table("inventory_items")
    op.execute("DROP TYPE IF EXISTS billing_cycle")
    op.execute("DROP TYPE IF EXISTS stock_movement_reason")
    op.execute("DROP TYPE IF EXISTS stock_unit")
