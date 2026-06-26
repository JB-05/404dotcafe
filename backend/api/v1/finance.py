from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.deps import require_roles
from models import User, UserRole
from schemas.finance import (
    FinanceSummaryResponse,
    FixedExpenseCreate,
    FixedExpenseResponse,
    FixedExpenseUpdate,
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
