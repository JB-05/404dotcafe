"""cafe operating sessions

Revision ID: 006
Revises: 005
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cafe_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cafe_id", sa.Integer(), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("opened_by_user_id", sa.Integer(), nullable=False),
        sa.Column("closed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["cafe_id"], ["cafes.id"]),
        sa.ForeignKeyConstraint(["opened_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["closed_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cafe_sessions_cafe_id", "cafe_sessions", ["cafe_id"])


def downgrade() -> None:
    op.drop_index("ix_cafe_sessions_cafe_id", table_name="cafe_sessions")
    op.drop_table("cafe_sessions")
