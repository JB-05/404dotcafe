from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from calendar import monthrange

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    BillingCycle,
    DailyFinancialSnapshot,
    FixedExpense,
    MenuCategory,
    MenuItem,
    Order,
    OrderItem,
    OrderStatus,
    StockMovement,
    StockMovementReason,
    VariableExpense,
)
from services import inventory_service


def _paise_to_rupees(amount_paise: int) -> int:
    """Finance dashboard uses rupees (orders/menu). Expenses are stored in paise."""
    return round(amount_paise / 100)


def _expense_lines_in_rupees(lines: list[dict]) -> list[dict]:
    converted: list[dict] = []
    for line in lines:
        entry = {**line}
        entry["amount"] = _paise_to_rupees(line["amount"])
        daily = line.get("daily_amount")
        if daily is not None:
            entry["daily_amount"] = _paise_to_rupees(int(daily))
        converted.append(entry)
    return converted


def _daily_fixed_amount(amount: int, cycle: BillingCycle) -> int:
    if cycle == BillingCycle.DAILY:
        return amount
    if cycle == BillingCycle.MONTHLY:
        return round(amount / 30)
    return round(amount / 365)


def _day_bounds(target: date) -> tuple[datetime, datetime]:
    start = datetime.combine(target, time.min, tzinfo=timezone.utc)
    end = datetime.combine(target, time.max, tzinfo=timezone.utc)
    return start, end


def _expense_effective_date(expense: FixedExpense) -> date:
    ts = expense.created_at
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(timezone.utc).date()


def _expense_active_on_date(expense: FixedExpense, target: date) -> bool:
    return expense.is_active and _expense_effective_date(expense) <= target


def _days_active_in_range(expense: FixedExpense, start: date, end: date) -> int:
    if not expense.is_active:
        return 0
    effective = _expense_effective_date(expense)
    if effective > end:
        return 0
    active_start = max(start, effective)
    return (end - active_start).days + 1


async def _load_active_fixed_expenses(db: AsyncSession, cafe_id: int) -> list[FixedExpense]:
    result = await db.execute(
        select(FixedExpense).where(FixedExpense.cafe_id == cafe_id, FixedExpense.is_active.is_(True))
    )
    return list(result.scalars().all())


def sum_daily_fixed_for_expenses(expenses: list[FixedExpense], target: date) -> int:
    return sum(
        _daily_fixed_amount(expense.amount, expense.billing_cycle)
        for expense in expenses
        if _expense_active_on_date(expense, target)
    )


def sum_fixed_for_expenses_in_range(expenses: list[FixedExpense], start: date, end: date) -> int:
    total = 0
    for expense in expenses:
        days = _days_active_in_range(expense, start, end)
        if days > 0:
            total += _daily_fixed_amount(expense.amount, expense.billing_cycle) * days
    return total


async def sum_daily_fixed(db: AsyncSession, cafe_id: int, target: date | None = None) -> int:
    target = target or date.today()
    expenses = await _load_active_fixed_expenses(db, cafe_id)
    return sum_daily_fixed_for_expenses(expenses, target)


async def sum_fixed_for_range(db: AsyncSession, cafe_id: int, start: date, end: date) -> int:
    expenses = await _load_active_fixed_expenses(db, cafe_id)
    return sum_fixed_for_expenses_in_range(expenses, start, end)


async def sum_variable_for_date(db: AsyncSession, cafe_id: int, target: date) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(VariableExpense.amount), 0)).where(
            VariableExpense.cafe_id == cafe_id, VariableExpense.expense_date == target
        )
    )
    return int(result.scalar_one())


async def calculate_cogs_for_date(db: AsyncSession, cafe_id: int, target: date) -> int:
    start, end = _day_bounds(target)
    return await _effective_cogs(db, cafe_id, start, end)


async def calculate_revenue_for_date(db: AsyncSession, cafe_id: int, target: date) -> tuple[int, int]:
    start, end = _day_bounds(target)
    return await _revenue_in_range(db, cafe_id, start, end)


async def _revenue_in_range(
    db: AsyncSession, cafe_id: int, start: datetime, end: datetime
) -> tuple[int, int]:
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


async def _cogs_in_range(db: AsyncSession, cafe_id: int, start: datetime, end: datetime) -> int:
    from models import InventoryItem

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


async def _variable_in_range(db: AsyncSession, cafe_id: int, start: date, end: date) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(VariableExpense.amount), 0)).where(
            VariableExpense.cafe_id == cafe_id,
            VariableExpense.expense_date >= start,
            VariableExpense.expense_date <= end,
        )
    )
    return int(result.scalar_one())


def _margin_pct(price: int, cost: int) -> float:
    if price <= 0:
        return 0.0
    return round(((price - cost) / price) * 100, 2)


def _cost_from_margin(price: int, margin_pct: float) -> int:
    return max(0, round(price * (1 - margin_pct / 100)))


def _economics_dict(item: MenuItem, category_name: str | None = None) -> dict:
    cost = item.unit_cost or 0
    margin = float(item.target_margin_pct) if item.target_margin_pct is not None else _margin_pct(item.price, cost)
    return {
        "id": item.id,
        "name": item.name,
        "external_id": item.external_id,
        "price": item.price,
        "unit_cost": cost,
        "profit_per_unit": item.price - cost,
        "margin_pct": _margin_pct(item.price, cost),
        "target_margin_pct": margin,
        "category_name": category_name,
    }


async def _item_cogs_in_range(db: AsyncSession, cafe_id: int, start: datetime, end: datetime) -> int:
    result = await db.execute(
        select(
            func.coalesce(
                func.sum(OrderItem.quantity * func.coalesce(MenuItem.unit_cost, 0)),
                0,
            )
        )
        .select_from(OrderItem)
        .join(Order, OrderItem.order_id == Order.id)
        .outerjoin(MenuItem, OrderItem.menu_item_id == MenuItem.id)
        .where(
            Order.cafe_id == cafe_id,
            Order.order_status == OrderStatus.COMPLETED,
            Order.created_at >= start,
            Order.created_at <= end,
        )
    )
    return int(result.scalar_one())


async def item_sales_profit_breakdown(
    db: AsyncSession, cafe_id: int, start: datetime, end: datetime
) -> list[dict]:
    result = await db.execute(
        select(
            MenuItem.id,
            MenuItem.name,
            MenuItem.unit_cost,
            func.sum(OrderItem.quantity),
            func.sum(OrderItem.subtotal),
            func.sum(OrderItem.quantity * func.coalesce(MenuItem.unit_cost, 0)),
        )
        .select_from(OrderItem)
        .join(Order, OrderItem.order_id == Order.id)
        .outerjoin(MenuItem, OrderItem.menu_item_id == MenuItem.id)
        .where(
            Order.cafe_id == cafe_id,
            Order.order_status == OrderStatus.COMPLETED,
            Order.created_at >= start,
            Order.created_at <= end,
        )
        .group_by(MenuItem.id, MenuItem.name, MenuItem.unit_cost)
        .order_by(func.sum(OrderItem.subtotal).desc())
    )
    rows = []
    for item_id, name, unit_cost, qty, revenue, cost in result.all():
        qty = int(qty or 0)
        revenue = int(revenue or 0)
        cost = int(cost or 0)
        profit = revenue - cost
        margin = round((profit / revenue) * 100, 2) if revenue > 0 else 0.0
        rows.append(
            {
                "menu_item_id": item_id or 0,
                "name": name or "Unknown",
                "quantity_sold": qty,
                "revenue": revenue,
                "cost": cost,
                "profit": profit,
                "margin_pct": margin,
                "unit_cost": int(unit_cost or 0),
            }
        )
    return rows


async def list_menu_item_economics(db: AsyncSession, cafe_id: int) -> list[dict]:
    result = await db.execute(
        select(MenuItem, MenuCategory.name)
        .join(MenuCategory, MenuCategory.id == MenuItem.category_id)
        .where(MenuItem.cafe_id == cafe_id)
        .order_by(MenuCategory.display_order.asc(), MenuItem.name.asc())
    )
    return [_economics_dict(item, cat_name) for item, cat_name in result.all()]


async def update_menu_item_economics(
    db: AsyncSession,
    cafe_id: int,
    menu_item_id: int,
    unit_cost: int | None = None,
    target_margin_pct: float | None = None,
) -> dict:
    from fastapi import HTTPException, status

    result = await db.execute(
        select(MenuItem, MenuCategory.name)
        .join(MenuCategory, MenuCategory.id == MenuItem.category_id)
        .where(MenuItem.id == menu_item_id, MenuItem.cafe_id == cafe_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found")
    item, cat_name = row

    if target_margin_pct is not None:
        item.target_margin_pct = round(target_margin_pct, 2)
        item.unit_cost = _cost_from_margin(item.price, target_margin_pct)
    elif unit_cost is not None:
        item.unit_cost = max(0, unit_cost)
        item.target_margin_pct = _margin_pct(item.price, item.unit_cost)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide unit_cost or target_margin_pct",
        )

    await db.commit()
    await db.refresh(item)
    return _economics_dict(item, cat_name)


async def _effective_cogs(db: AsyncSession, cafe_id: int, start: datetime, end: datetime) -> int:
    item_cogs = await _item_cogs_in_range(db, cafe_id, start, end)
    if item_cogs > 0:
        return item_cogs
    return _paise_to_rupees(await _cogs_in_range(db, cafe_id, start, end))


async def fixed_breakdown_daily(db: AsyncSession, cafe_id: int, target: date | None = None) -> list[dict]:
    target = target or date.today()
    expenses = await _load_active_fixed_expenses(db, cafe_id)
    rows = []
    for expense in expenses:
        if not _expense_active_on_date(expense, target):
            continue
        daily = _daily_fixed_amount(expense.amount, expense.billing_cycle)
        rows.append(
            {
                "name": expense.name,
                "amount": daily,
                "daily_amount": daily,
                "billing_cycle": expense.billing_cycle.value,
            }
        )
    return sorted(rows, key=lambda r: r["amount"], reverse=True)


async def fixed_breakdown_monthly(
    db: AsyncSession, cafe_id: int, start: date, end: date
) -> list[dict]:
    expenses = await _load_active_fixed_expenses(db, cafe_id)
    rows = []
    for expense in expenses:
        days = _days_active_in_range(expense, start, end)
        if days == 0:
            continue
        daily = _daily_fixed_amount(expense.amount, expense.billing_cycle)
        rows.append(
            {
                "name": expense.name,
                "amount": daily * days,
                "daily_amount": daily,
                "billing_cycle": expense.billing_cycle.value,
            }
        )
    return sorted(rows, key=lambda r: r["amount"], reverse=True)


async def fixed_breakdown_yearly(db: AsyncSession, cafe_id: int, start: date, end: date) -> list[dict]:
    expenses = await _load_active_fixed_expenses(db, cafe_id)
    rows = []
    for expense in expenses:
        days = _days_active_in_range(expense, start, end)
        if days == 0:
            continue
        daily = _daily_fixed_amount(expense.amount, expense.billing_cycle)
        rows.append(
            {
                "name": expense.name,
                "amount": daily * days,
                "daily_amount": daily,
                "billing_cycle": expense.billing_cycle.value,
            }
        )
    return sorted(rows, key=lambda r: r["amount"], reverse=True)


async def variable_breakdown_for_date(db: AsyncSession, cafe_id: int, target: date) -> list[dict]:
    result = await db.execute(
        select(VariableExpense.category, func.coalesce(func.sum(VariableExpense.amount), 0))
        .where(VariableExpense.cafe_id == cafe_id, VariableExpense.expense_date == target)
        .group_by(VariableExpense.category)
        .order_by(func.sum(VariableExpense.amount).desc())
    )
    return [
        {"category": cat, "amount": int(amt), "daily_amount": int(amt)}
        for cat, amt in result.all()
    ]


async def variable_breakdown_for_range(
    db: AsyncSession, cafe_id: int, start: date, end: date, days_in_period: int | None = None
) -> list[dict]:
    result = await db.execute(
        select(VariableExpense.category, func.coalesce(func.sum(VariableExpense.amount), 0))
        .where(
            VariableExpense.cafe_id == cafe_id,
            VariableExpense.expense_date >= start,
            VariableExpense.expense_date <= end,
        )
        .group_by(VariableExpense.category)
        .order_by(func.sum(VariableExpense.amount).desc())
    )
    days = days_in_period or max(1, (end - start).days + 1)
    rows = []
    for cat, amt in result.all():
        total = int(amt)
        rows.append(
            {
                "category": cat,
                "amount": total,
                "daily_amount": round(total / days) if days > 1 else total,
            }
        )
    return rows


async def _day_metrics(db: AsyncSession, cafe_id: int, target: date) -> dict:
    start, end = _day_bounds(target)
    revenue, completed = await _revenue_in_range(db, cafe_id, start, end)
    status_counts = await count_orders_by_status(db, cafe_id, target)
    cogs = await _effective_cogs(db, cafe_id, start, end)
    fixed = _paise_to_rupees(await sum_daily_fixed(db, cafe_id, target))
    variable = _paise_to_rupees(await sum_variable_for_date(db, cafe_id, target))
    gross = revenue - cogs
    net = revenue - (cogs + fixed + variable)
    margin = round((net / revenue) * 100, 2) if revenue > 0 else 0.0
    aov = round(revenue / completed) if completed > 0 else 0
    return {
        "date": target.isoformat(),
        "revenue": revenue,
        "order_count": status_counts["total"],
        "completed_orders": completed,
        "average_order_value": aov,
        "cogs": cogs,
        "fixed_expenses": fixed,
        "variable_expenses": variable,
        "daily_fixed": fixed,
        "daily_variable": variable,
        "gross_profit": gross,
        "net_profit": net,
        "profit_margin_pct": margin,
        "fixed_breakdown": _expense_lines_in_rupees(await fixed_breakdown_daily(db, cafe_id, target)),
        "variable_breakdown": _expense_lines_in_rupees(
            await variable_breakdown_for_date(db, cafe_id, target)
        ),
        "item_sales": await item_sales_profit_breakdown(db, cafe_id, start, end),
    }


async def build_daily_trend(db: AsyncSession, cafe_id: int, days: int = 30) -> list[dict]:
    days = min(max(days, 1), 90)
    end = date.today()
    start = end - timedelta(days=days - 1)
    points = []
    current = start
    while current <= end:
        points.append(await _day_metrics(db, cafe_id, current))
        current += timedelta(days=1)
    return points


async def build_monthly_summary(db: AsyncSession, cafe_id: int, year: int, month: int) -> dict:
    last_day = monthrange(year, month)[1]
    start_d = date(year, month, 1)
    end_d = date(year, month, last_day)
    start_dt, _ = _day_bounds(start_d)
    _, end_dt = _day_bounds(end_d)

    revenue, completed = await _revenue_in_range(db, cafe_id, start_dt, end_dt)
    cogs = await _effective_cogs(db, cafe_id, start_dt, end_dt)
    today = date.today()
    period_end = end_d
    if year == today.year and month == today.month:
        period_end = min(end_d, today)
    days_elapsed = (period_end - start_d).days + 1
    fixed = _paise_to_rupees(await sum_fixed_for_range(db, cafe_id, start_d, period_end))
    daily_fixed = round(fixed / days_elapsed) if days_elapsed > 0 else 0
    variable = _paise_to_rupees(await _variable_in_range(db, cafe_id, start_d, period_end))
    daily_variable = round(variable / days_elapsed) if days_elapsed > 0 else 0
    gross = revenue - cogs
    net = revenue - (cogs + fixed + variable)
    margin = round((net / revenue) * 100, 2) if revenue > 0 else 0.0
    aov = round(revenue / completed) if completed > 0 else 0

    return {
        "year": year,
        "month": month,
        "label": start_d.strftime("%B %Y"),
        "days_in_month": last_day,
        "revenue": revenue,
        "completed_orders": completed,
        "average_order_value": aov,
        "cogs": cogs,
        "fixed_expenses": fixed,
        "variable_expenses": variable,
        "daily_fixed": daily_fixed,
        "daily_variable": daily_variable,
        "gross_profit": gross,
        "net_profit": net,
        "profit_margin_pct": margin,
        "fixed_breakdown": _expense_lines_in_rupees(
            await fixed_breakdown_monthly(db, cafe_id, start_d, period_end)
        ),
        "variable_breakdown": _expense_lines_in_rupees(
            await variable_breakdown_for_range(
                db, cafe_id, start_d, period_end, days_in_period=days_elapsed
            )
        ),
    }


async def build_monthly_trend(db: AsyncSession, cafe_id: int, months: int = 12) -> list[dict]:
    months = min(max(months, 1), 24)
    today = date.today()
    points: list[dict] = []
    y, m = today.year, today.month
    for _ in range(months):
        points.append(await build_monthly_summary(db, cafe_id, y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    points.reverse()
    return points


async def build_yearly_summary(db: AsyncSession, cafe_id: int, year: int) -> dict:
    start_d = date(year, 1, 1)
    end_d = date(year, 12, 31)
    start_dt, _ = _day_bounds(start_d)
    _, end_dt = _day_bounds(end_d)

    revenue, completed = await _revenue_in_range(db, cafe_id, start_dt, end_dt)
    cogs = await _effective_cogs(db, cafe_id, start_dt, end_dt)
    today = date.today()
    period_end = end_d if year < today.year else min(end_d, today)
    days_elapsed = (period_end - start_d).days + 1
    fixed = _paise_to_rupees(await sum_fixed_for_range(db, cafe_id, start_d, period_end))
    fixed_items = _expense_lines_in_rupees(
        await fixed_breakdown_yearly(db, cafe_id, start_d, period_end)
    )
    variable = _paise_to_rupees(await _variable_in_range(db, cafe_id, start_d, period_end))
    daily_fixed = round(fixed / days_elapsed) if days_elapsed > 0 else 0
    daily_variable = round(variable / days_elapsed) if days_elapsed > 0 else 0
    gross = revenue - cogs
    net = revenue - (cogs + fixed + variable)
    margin = round((net / revenue) * 100, 2) if revenue > 0 else 0.0
    aov = round(revenue / completed) if completed > 0 else 0

    return {
        "year": year,
        "label": str(year),
        "revenue": revenue,
        "completed_orders": completed,
        "average_order_value": aov,
        "cogs": cogs,
        "fixed_expenses": fixed,
        "variable_expenses": variable,
        "daily_fixed": daily_fixed,
        "daily_variable": daily_variable,
        "gross_profit": gross,
        "net_profit": net,
        "profit_margin_pct": margin,
        "fixed_breakdown": fixed_items,
        "variable_breakdown": _expense_lines_in_rupees(
            await variable_breakdown_for_range(
                db, cafe_id, start_d, period_end, days_in_period=days_elapsed
            )
        ),
    }


async def build_yearly_trend(db: AsyncSession, cafe_id: int, years: int = 3) -> list[dict]:
    years = min(max(years, 1), 10)
    current = date.today().year
    points = []
    for y in range(current - years + 1, current + 1):
        points.append(await build_yearly_summary(db, cafe_id, y))
    return points


async def build_expense_timeline(
    db: AsyncSession, cafe_id: int, period: str, year: int, month: int | None = None
) -> dict:
    if period == "daily" and month:
        last_day = monthrange(year, month)[1]
        points = []
        for day in range(1, last_day + 1):
            target = date(year, month, day)
            if target > date.today():
                break
            metrics = await _day_metrics(db, cafe_id, target)
            points.append(metrics)
        return {"period": "daily", "year": year, "month": month, "points": points}

    if period == "monthly":
        points = []
        for m in range(1, 13):
            if date(year, m, 1) > date.today():
                break
            points.append(await build_monthly_summary(db, cafe_id, year, m))
        return {"period": "monthly", "year": year, "points": points}

    if period == "yearly":
        return {"period": "yearly", "points": await build_yearly_trend(db, cafe_id, 5)}

    raise ValueError(f"Unsupported period: {period}")


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
    fixed = _paise_to_rupees(await sum_daily_fixed(db, cafe_id, target))
    variable = _paise_to_rupees(await sum_variable_for_date(db, cafe_id, target))
    gross = revenue - cogs
    net = revenue - (cogs + fixed + variable)
    margin = round((net / revenue) * 100, 2) if revenue > 0 else 0.0

    alerts = await inventory_service.list_alerts(db, cafe_id)
    aov = round(revenue / completed_count) if completed_count > 0 else 0
    start, end = _day_bounds(target)

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
        "daily_fixed": fixed,
        "daily_variable": variable,
        "gross_profit": gross,
        "net_profit": net,
        "profit_margin_pct": margin,
        "break_even_sales": None,
        "low_stock_count": len(alerts),
        "hourly_sales": await hourly_sales(db, cafe_id, target),
        "fixed_breakdown": _expense_lines_in_rupees(await fixed_breakdown_daily(db, cafe_id, target)),
        "variable_breakdown": _expense_lines_in_rupees(
            await variable_breakdown_for_date(db, cafe_id, target)
        ),
        "item_sales": await item_sales_profit_breakdown(db, cafe_id, start, end),
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
        rows.append(_fixed_expense_to_dict(expense))
    return rows


def _fixed_expense_to_dict(expense: FixedExpense) -> dict:
    return {
        "id": expense.id,
        "name": expense.name,
        "amount": expense.amount,
        "billing_cycle": expense.billing_cycle.value,
        "is_active": expense.is_active,
        "daily_amount": _daily_fixed_amount(expense.amount, expense.billing_cycle),
    }


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
    return _fixed_expense_to_dict(expense)


async def update_fixed_expense(
    db: AsyncSession, cafe_id: int, expense_id: int, body
) -> dict:
    from fastapi import HTTPException, status

    result = await db.execute(
        select(FixedExpense).where(
            FixedExpense.id == expense_id,
            FixedExpense.cafe_id == cafe_id,
        )
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fixed expense not found")

    if body.name is not None:
        expense.name = body.name.strip()
    if body.amount is not None:
        expense.amount = body.amount
    if body.billing_cycle is not None:
        expense.billing_cycle = body.billing_cycle
    if body.is_active is not None:
        expense.is_active = body.is_active

    await db.commit()
    await db.refresh(expense)
    return _fixed_expense_to_dict(expense)


async def delete_fixed_expense(db: AsyncSession, cafe_id: int, expense_id: int) -> None:
    from fastapi import HTTPException, status

    result = await db.execute(
        select(FixedExpense).where(
            FixedExpense.id == expense_id,
            FixedExpense.cafe_id == cafe_id,
        )
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fixed expense not found")

    await db.delete(expense)
    await db.commit()


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
