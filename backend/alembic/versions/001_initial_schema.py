"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-23
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cafes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("slug", sa.String(80), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cafe_id", sa.Integer(), sa.ForeignKey("cafes.id"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum("STAFF", "KITCHEN", "ADMIN", name="user_role"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_table(
        "menu_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cafe_id", sa.Integer(), sa.ForeignKey("cafes.id"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default="0"),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true")),
    )
    op.create_table(
        "menu_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cafe_id", sa.Integer(), sa.ForeignKey("cafes.id"), nullable=False),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("menu_categories.id"), nullable=False),
        sa.Column("external_id", sa.String(80), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("image_url", sa.String(500)),
        sa.Column("veg", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("available", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("prep_time", sa.Integer(), server_default="10"),
        sa.Column("customizations", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("menu_items")
    op.drop_table("menu_categories")
    op.drop_table("users")
    op.drop_table("cafes")
    op.execute("DROP TYPE IF EXISTS user_role")
