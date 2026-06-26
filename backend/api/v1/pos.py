from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.deps import require_roles
from models import User, UserRole
from schemas.order import OrderResponse
from schemas.pos import OrderActionRequest, PaymentConfirmRequest, PosAddItemsRequest, PosCreateOrderRequest, PosUpdateOrderRequest
from services.order_service import (
    _order_to_response,
    add_items_to_order,
    cancel_order,
    complete_order,
    create_order,
    list_pos_orders,
    mark_order_paid,
    update_pending_order,
)

router = APIRouter(prefix="/pos", tags=["pos"])

StaffUser = Annotated[User, Depends(require_roles(UserRole.STAFF, UserRole.ADMIN))]


@router.get("/orders", response_model=list[OrderResponse])
async def get_pos_orders(db: Annotated[AsyncSession, Depends(get_db)], _: StaffUser):
    orders = await list_pos_orders(db, settings.cafe_id)
    return [_order_to_response(o) for o in orders]


@router.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_pos_order(
    body: PosCreateOrderRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: StaffUser,
):
    order = await create_order(db, body)
    return _order_to_response(order)


@router.patch("/orders/{order_id}", response_model=OrderResponse)
async def update_pos_order(
    order_id: int,
    body: PosUpdateOrderRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: StaffUser,
):
    order = await update_pending_order(
        db,
        order_id,
        body.customer_name,
        body.customer_phone,
        body.table_number,
        body.notes,
        body.items,
        body.version,
    )
    return _order_to_response(order)


@router.post("/orders/{order_id}/items", response_model=OrderResponse)
async def append_pos_order_items(
    order_id: int,
    body: PosAddItemsRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    staff: StaffUser,
):
    order = await add_items_to_order(db, order_id, body.items, body.version, staff)
    return _order_to_response(order)


@router.patch("/orders/{order_id}/complete", response_model=OrderResponse)
async def complete_pos_order(
    order_id: int,
    body: OrderActionRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: StaffUser,
):
    order = await complete_order(db, order_id, body.version)
    return _order_to_response(order)


@router.patch("/orders/{order_id}/payment", response_model=OrderResponse)
async def confirm_payment(
    order_id: int,
    body: PaymentConfirmRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    staff: StaffUser,
):
    order = await mark_order_paid(db, order_id, staff, body.version, body.upi_txn_last5)
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
