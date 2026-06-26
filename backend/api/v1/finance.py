from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.deps import require_roles
from models import User, UserRole
from schemas.finance import (
    DailyTrendResponse,
    FinanceSummaryResponse,
    FixedExpenseCreate,
    FixedExpenseResponse,
    FixedExpenseUpdate,
    MonthlySummaryResponse,
    MonthlyTrendResponse,
    ExpenseTimelineResponse,
    ItemSalesProfit,
    MenuItemEconomicsResponse,
    MenuItemEconomicsUpdate,
    YearlySummaryResponse,
    YearlyTrendResponse,
    VariableExpenseCreate,
    VariableExpenseResponse,
)
from services import finance_service, inventory_service

router = APIRouter(prefix="/finance", tags=["finance"])

AdminUser = Annotated[User, Depends(require_roles(UserRole.ADMIN))]


@router.get("/summary", response_model=FinanceSummaryResponse)
async def get_finance_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
    target_date: date | None = Query(None, alias="date"),
):
    return await finance_service.build_finance_summary(db, settings.cafe_id, target_date)


@router.post("/snapshot")
async def compute_snapshot(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
    target_date: date | None = Query(None, alias="date"),
):
    snapshot = await finance_service.save_daily_snapshot(db, settings.cafe_id, target_date)
    return {
        "snapshot_date": snapshot.snapshot_date.isoformat(),
        "net_profit": snapshot.net_profit,
        "revenue": snapshot.revenue,
    }


@router.get("/fixed", response_model=list[FixedExpenseResponse])
async def list_fixed(db: Annotated[AsyncSession, Depends(get_db)], _: AdminUser):
    return await finance_service.list_fixed_expenses(db, settings.cafe_id)


@router.post("/fixed", response_model=FixedExpenseResponse)
async def create_fixed(
    body: FixedExpenseCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    return await finance_service.create_fixed_expense(db, settings.cafe_id, body)


@router.patch("/fixed/{expense_id}", response_model=FixedExpenseResponse)
async def update_fixed(
    expense_id: int,
    body: FixedExpenseUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    return await finance_service.update_fixed_expense(db, settings.cafe_id, expense_id, body)


@router.delete("/fixed/{expense_id}", status_code=204)
async def delete_fixed(
    expense_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    await finance_service.delete_fixed_expense(db, settings.cafe_id, expense_id)


@router.get("/variable", response_model=list[VariableExpenseResponse])
async def list_variable(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
    target_date: date | None = Query(None, alias="date"),
):
    return await finance_service.list_variable_expenses(db, settings.cafe_id, target_date)


@router.post("/variable", response_model=VariableExpenseResponse)
async def create_variable(
    body: VariableExpenseCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    staff: AdminUser,
):
    return await finance_service.create_variable_expense(db, settings.cafe_id, body, staff.id)


@router.get("/overview")
async def admin_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
    target_date: date | None = Query(None, alias="date"),
):
    summary = await finance_service.build_finance_summary(db, settings.cafe_id, target_date)
    alerts = await inventory_service.list_alerts(db, settings.cafe_id)
    return {"summary": summary, "alerts": alerts}


@router.get("/daily-trend", response_model=DailyTrendResponse)
async def daily_trend(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
    days: int = Query(30, ge=1, le=90),
):
    points = await finance_service.build_daily_trend(db, settings.cafe_id, days)
    return {"days": days, "points": points}


@router.get("/monthly", response_model=MonthlySummaryResponse)
async def monthly_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
):
    return await finance_service.build_monthly_summary(db, settings.cafe_id, year, month)


@router.get("/monthly-trend", response_model=MonthlyTrendResponse)
async def monthly_trend(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
    months: int = Query(12, ge=1, le=24),
):
    points = await finance_service.build_monthly_trend(db, settings.cafe_id, months)
    return {"months": months, "points": points}


@router.get("/yearly", response_model=YearlySummaryResponse)
async def yearly_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
    year: int = Query(..., ge=2020, le=2100),
):
    return await finance_service.build_yearly_summary(db, settings.cafe_id, year)


@router.get("/yearly-trend", response_model=YearlyTrendResponse)
async def yearly_trend(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
    years: int = Query(5, ge=1, le=10),
):
    points = await finance_service.build_yearly_trend(db, settings.cafe_id, years)
    return {"years": years, "points": points}


@router.get("/expense-timeline", response_model=ExpenseTimelineResponse)
async def expense_timeline(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
    period: str = Query("monthly", pattern="^(daily|monthly|yearly)$"),
    year: int = Query(..., ge=2020, le=2100),
    month: int | None = Query(None, ge=1, le=12),
):
    if period == "daily" and not month:
        raise HTTPException(status_code=400, detail="month is required for daily period")
    return await finance_service.build_expense_timeline(db, settings.cafe_id, period, year, month)


@router.get("/menu-items", response_model=list[MenuItemEconomicsResponse])
async def list_menu_item_economics(db: Annotated[AsyncSession, Depends(get_db)], _: AdminUser):
    return await finance_service.list_menu_item_economics(db, settings.cafe_id)


@router.patch("/menu-items/{menu_item_id}", response_model=MenuItemEconomicsResponse)
async def update_menu_item_economics(
    menu_item_id: int,
    body: MenuItemEconomicsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    return await finance_service.update_menu_item_economics(
        db,
        settings.cafe_id,
        menu_item_id,
        unit_cost=body.unit_cost,
        target_margin_pct=body.target_margin_pct,
    )
