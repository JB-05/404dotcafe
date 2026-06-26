from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    BillingCycle,
    DailyFinancialSnapshot,
    FixedExpense,
    Order,
    OrderStatus,
    StockMovement,
    StockMovementReason,
    VariableExpense,
)
from services import inventory_service


def _daily_fixed_amount(amount: int, cycle: BillingCycle) -> int:
    if cycle == BillingCycle.MONTHLY:
        return round(amount / 30)
    return round(amount / 365)


def _day_bounds(target: date) -> tuple[datetime, datetime]:
    start = datetime.combine(target, time.min, tzinfo=timezone.utc)
    end = datetime.combine(target, time.max, tzinfo=timezone.utc)
    return start, end


async def sum_daily_fixed(db: AsyncSession, cafe_id: int) -> int:
    result = await db.execute(
        select(FixedExpense).where(FixedExpense.cafe_id == cafe_id, FixedExpense.is_active.is_(True))
    )
    return sum(_daily_fixed_amount(e.amount, e.billing_cycle) for e in result.scalars().all())


async def sum_variable_for_date(db: AsyncSession, cafe_id: int, target: date) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(VariableExpense.amount), 0)).where(
            VariableExpense.cafe_id == cafe_id, VariableExpense.expense_date == target
        )
    )
    return int(result.scalar_one())


async def calculate_cogs_for_date(db: AsyncSession, cafe_id: int, target: date) -> int:
    from models import InventoryItem

    start, end = _day_bounds(target)
    mov_result = await db.execute(
        select(StockMovement, InventoryItem)
        .join(InventoryItem, InventoryItem.id == StockMovement.inventory_item_id)
        .where(
            StockMovement.cafe_id == cafe_id,
            StockMovement.reason == StockMovementReason.ORDER_FULFILLMENT,
            StockMovement.created_at >= start,
            StockMovement.created_at <= end,
        )
    )
    total = 0
    for movement, inv in mov_result.all():
        qty = abs(Decimal(str(movement.quantity_change)))
        total += int(qty * inv.cost_per_unit)
    return total


async def calculate_revenue_for_date(db: AsyncSession, cafe_id: int, target: date) -> tuple[int, int]:
    start, end = _day_bounds(target)
    result = await db.execute(
        select(func.coalesce(func.sum(Order.total), 0), func.count(Order.id)).where(
            Order.cafe_id == cafe_id,
            Order.order_status == OrderStatus.COMPLETED,
            Order.created_at >= start,
            Order.created_at <= end,
        )
    )
    revenue, count = result.one()
    return int(revenue or 0), int(count or 0)


async def count_orders_by_status(db: AsyncSession, cafe_id: int, target: date) -> dict[str, int]:
    start, end = _day_bounds(target)
    result = await db.execute(
        select(Order.order_status, func.count(Order.id))
        .where(Order.cafe_id == cafe_id, Order.created_at >= start, Order.created_at <= end)
        .group_by(Order.order_status)
    )
    counts = {status.value: count for status, count in result.all()}
    pending = counts.get(OrderStatus.PENDING_PAYMENT.value, 0)
    completed = counts.get(OrderStatus.COMPLETED.value, 0)
    return {"pending": pending, "completed": completed, "total": sum(counts.values())}


async def hourly_sales(db: AsyncSession, cafe_id: int, target: date) -> list[dict]:
    start, end = _day_bounds(target)
    result = await db.execute(
        select(
            func.extract("hour", Order.created_at).label("hour"),
            func.coalesce(func.sum(Order.total), 0),
            func.count(Order.id),
        )
        .where(
            Order.cafe_id == cafe_id,
            Order.order_status == OrderStatus.COMPLETED,
            Order.created_at >= start,
            Order.created_at <= end,
        )
        .group_by("hour")
        .order_by("hour")
    )
    by_hour = {int(row.hour): {"hour": int(row.hour), "revenue": int(row[1]), "order_count": int(row[2])} for row in result.all()}
    return [by_hour.get(h, {"hour": h, "revenue": 0, "order_count": 0}) for h in range(24)]


async def build_finance_summary(db: AsyncSession, cafe_id: int, target: date | None = None) -> dict:
    target = target or date.today()
    revenue, completed_count = await calculate_revenue_for_date(db, cafe_id, target)
    status_counts = await count_orders_by_status(db, cafe_id, target)
    cogs = await calculate_cogs_for_date(db, cafe_id, target)
    fixed = await sum_daily_fixed(db, cafe_id)
    variable = await sum_variable_for_date(db, cafe_id, target)
    gross = revenue - cogs
    net = revenue - (cogs + fixed + variable)
    margin = round((net / revenue) * 100, 2) if revenue > 0 else 0.0

    cogs_rate = (cogs / revenue) if revenue > 0 else 0
    var_rate = (variable / revenue) if revenue > 0 else 0
    cost_rate = cogs_rate + var_rate
    break_even = round(fixed / (1 - cost_rate)) if cost_rate < 1 and fixed > 0 else None

    alerts = await inventory_service.list_alerts(db, cafe_id)
    aov = round(revenue / completed_count) if completed_count > 0 else 0

    return {
        "date": target.isoformat(),
        "revenue": revenue,
        "order_count": status_counts["total"],
        "average_order_value": aov,
        "pending_orders": status_counts["pending"],
        "completed_orders": status_counts["completed"],
        "cogs": cogs,
        "fixed_expenses": fixed,
        "variable_expenses": variable,
        "gross_profit": gross,
        "net_profit": net,
        "profit_margin_pct": margin,
        "break_even_sales": break_even,
        "low_stock_count": len(alerts),
        "hourly_sales": await hourly_sales(db, cafe_id, target),
    }


async def save_daily_snapshot(db: AsyncSession, cafe_id: int, target: date | None = None) -> DailyFinancialSnapshot:
    target = target or date.today()
    summary = await build_finance_summary(db, cafe_id, target)

    result = await db.execute(
        select(DailyFinancialSnapshot).where(
            DailyFinancialSnapshot.cafe_id == cafe_id,
            DailyFinancialSnapshot.snapshot_date == target,
        )
    )
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        snapshot = DailyFinancialSnapshot(cafe_id=cafe_id, snapshot_date=target)
        db.add(snapshot)

    snapshot.revenue = summary["revenue"]
    snapshot.cogs = summary["cogs"]
    snapshot.fixed_expenses = summary["fixed_expenses"]
    snapshot.variable_expenses = summary["variable_expenses"]
    snapshot.gross_profit = summary["gross_profit"]
    snapshot.net_profit = summary["net_profit"]
    snapshot.profit_margin_pct = summary["profit_margin_pct"]
    snapshot.order_count = summary["completed_orders"]
    snapshot.computed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(snapshot)
    return snapshot


async def list_fixed_expenses(db: AsyncSession, cafe_id: int) -> list[dict]:
    result = await db.execute(
        select(FixedExpense)
        .where(FixedExpense.cafe_id == cafe_id)
        .order_by(FixedExpense.name.asc())
    )
    rows = []
    for expense in result.scalars().all():
        rows.append(
            {
                "id": expense.id,
                "name": expense.name,
                "amount": expense.amount,
                "billing_cycle": expense.billing_cycle.value,
                "is_active": expense.is_active,
                "daily_amount": _daily_fixed_amount(expense.amount, expense.billing_cycle),
            }
        )
    return rows


async def create_fixed_expense(db: AsyncSession, cafe_id: int, body) -> dict:
    expense = FixedExpense(
        cafe_id=cafe_id,
        name=body.name.strip(),
        amount=body.amount,
        billing_cycle=body.billing_cycle,
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return {
        "id": expense.id,
        "name": expense.name,
        "amount": expense.amount,
        "billing_cycle": expense.billing_cycle.value,
        "is_active": expense.is_active,
        "daily_amount": _daily_fixed_amount(expense.amount, expense.billing_cycle),
    }


async def list_variable_expenses(db: AsyncSession, cafe_id: int, target: date | None = None) -> list[dict]:
    query = select(VariableExpense).where(VariableExpense.cafe_id == cafe_id)
    if target:
        query = query.where(VariableExpense.expense_date == target)
    query = query.order_by(VariableExpense.expense_date.desc(), VariableExpense.id.desc())
    result = await db.execute(query)
    return [
        {
            "id": row.id,
            "expense_date": row.expense_date.isoformat(),
            "category": row.category,
            "amount": row.amount,
            "notes": row.notes,
        }
        for row in result.scalars().all()
    ]


async def create_variable_expense(db: AsyncSession, cafe_id: int, body, user_id: int) -> dict:
    row = VariableExpense(
        cafe_id=cafe_id,
        expense_date=body.expense_date,
        category=body.category.strip(),
        amount=body.amount,
        notes=body.notes,
        created_by_user_id=user_id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {
        "id": row.id,
        "expense_date": row.expense_date.isoformat(),
        "category": row.category,
        "amount": row.amount,
        "notes": row.notes,
    }
