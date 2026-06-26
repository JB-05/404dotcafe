import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class BillingCycle(str, enum.Enum):
    DAILY = "DAILY"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"


class FixedExpense(Base):
    __tablename__ = "fixed_expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cafe_id: Mapped[int] = mapped_column(ForeignKey("cafes.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    billing_cycle: Mapped[BillingCycle] = mapped_column(
        Enum(BillingCycle, name="billing_cycle", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class VariableExpense(Base):
    __tablename__ = "variable_expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cafe_id: Mapped[int] = mapped_column(ForeignKey("cafes.id"), nullable=False, index=True)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class DailyFinancialSnapshot(Base):
    __tablename__ = "daily_financial_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cafe_id: Mapped[int] = mapped_column(ForeignKey("cafes.id"), nullable=False, index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    revenue: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cogs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fixed_expenses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    variable_expenses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    gross_profit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    net_profit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    profit_margin_pct: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    order_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
