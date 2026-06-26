from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.deps import require_roles
from models import User, UserRole
from schemas.kitchen import KitchenStatusUpdate
from schemas.order import OrderResponse
from services.order_service import _order_to_response, list_kitchen_orders, update_kitchen_status

router = APIRouter(prefix="/kitchen", tags=["kitchen"])

KitchenUser = Annotated[User, Depends(require_roles(UserRole.KITCHEN, UserRole.ADMIN))]


@router.get("/orders", response_model=list[OrderResponse])
async def get_kitchen_orders(db: Annotated[AsyncSession, Depends(get_db)], _: KitchenUser):
    orders = await list_kitchen_orders(db, settings.cafe_id)
    return [_order_to_response(o) for o in orders]


@router.patch("/orders/{order_id}/status", response_model=OrderResponse)
async def advance_kitchen_order(
    order_id: int,
    body: KitchenStatusUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: KitchenUser,
):
    order = await update_kitchen_status(db, order_id, body.status, body.version)
    return _order_to_response(order)
