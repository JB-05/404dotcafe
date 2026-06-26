from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.deps import require_roles
from models import User, UserRole
from schemas.order import OrderResponse
from schemas.pos import OrderActionRequest
from services.order_service import (
    _order_to_response,
    cancel_order,
    list_pos_orders,
    mark_order_paid,
)

router = APIRouter(prefix="/pos", tags=["pos"])

StaffUser = Annotated[User, Depends(require_roles(UserRole.STAFF, UserRole.ADMIN))]


@router.get("/orders", response_model=list[OrderResponse])
async def get_pos_orders(db: Annotated[AsyncSession, Depends(get_db)], _: StaffUser):
    orders = await list_pos_orders(db, settings.cafe_id)
    return [_order_to_response(o) for o in orders]


@router.patch("/orders/{order_id}/payment", response_model=OrderResponse)
async def confirm_payment(
    order_id: int,
    body: OrderActionRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    staff: StaffUser,
):
    order = await mark_order_paid(db, order_id, staff, body.version)
    return _order_to_response(order)


@router.patch("/orders/{order_id}/cancel", response_model=OrderResponse)
async def cancel_pos_order(
    order_id: int,
    body: OrderActionRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    staff: StaffUser,
):
    order = await cancel_order(db, order_id, staff, body.version)
    return _order_to_response(order)
