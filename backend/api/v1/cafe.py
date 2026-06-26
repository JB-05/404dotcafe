from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.deps import require_roles
from models import User, UserRole
from schemas.cafe import CafeOperatingStatsResponse, CafeSessionResponse, CafeStatusResponse
from services import cafe_service

router = APIRouter(prefix="/cafe", tags=["cafe"])

AdminUser = Annotated[User, Depends(require_roles(UserRole.ADMIN))]


@router.get("/status", response_model=CafeStatusResponse)
async def cafe_status(db: Annotated[AsyncSession, Depends(get_db)]):
    return await cafe_service.get_status(db, settings.cafe_id)


@router.post("/open", response_model=CafeStatusResponse)
async def open_cafe(db: Annotated[AsyncSession, Depends(get_db)], admin: AdminUser):
    return await cafe_service.open_cafe(db, settings.cafe_id, admin.id)


@router.post("/close", response_model=CafeStatusResponse)
async def close_cafe(db: Annotated[AsyncSession, Depends(get_db)], admin: AdminUser):
    result = await cafe_service.close_cafe(db, settings.cafe_id, admin.id)
    return {
        "is_open": False,
        "session_id": result.get("session_id"),
        "opened_at": result.get("opened_at"),
        "opened_by_user_id": None,
        "current_session_seconds": 0,
    }


@router.get("/stats", response_model=CafeOperatingStatsResponse)
async def operating_stats(db: Annotated[AsyncSession, Depends(get_db)], _: AdminUser):
    return await cafe_service.get_operating_stats(db, settings.cafe_id)


@router.get("/sessions", response_model=list[CafeSessionResponse])
async def session_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
    limit: int = Query(30, ge=1, le=100),
):
    return await cafe_service.list_sessions(db, settings.cafe_id, limit)
