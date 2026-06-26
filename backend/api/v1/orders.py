from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from schemas.order import CreateOrderRequest, OrderResponse
from services.order_service import _order_to_response, create_order, get_order_by_id

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def post_order(
    body: CreateOrderRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
):
    order = await create_order(db, body, idempotency_key)
    return _order_to_response(order)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(order_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    order = await get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return _order_to_response(order)
