from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, case, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import settings
from core.events import order_events
from models import MenuItem, Order, OrderItem, OrderStatus, PaymentStatus, User
from schemas.order import CreateOrderRequest, OrderItemInput
from services import cafe_service


def _calc_tax(subtotal: int) -> tuple[int, int, int]:
    cgst = round(subtotal * 0.025)
    sgst = round(subtotal * 0.025)
    return cgst, sgst, subtotal + cgst + sgst


def _customization_price(menu_item: MenuItem, selected: list[str]) -> int:
    if not selected or not menu_item.customizations:
        return 0
    price_map = {c["name"]: c["price"] for c in menu_item.customizations}
    return sum(price_map.get(name, 0) for name in selected)


async def _next_order_number(db: AsyncSession, cafe_id: int) -> str:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.count(Order.id)).where(Order.cafe_id == cafe_id, Order.created_at >= today_start)
    )
    count = result.scalar_one() or 0
    return f"404-{count + 1:06d}"


async def _resolve_line(db: AsyncSession, cafe_id: int, line: OrderItemInput) -> tuple[MenuItem, int]:
    result = await db.execute(
        select(MenuItem).where(
            MenuItem.cafe_id == cafe_id,
            MenuItem.external_id == line.external_id,
        )
    )
    menu_item = result.scalar_one_or_none()
    if not menu_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Menu item not found: {line.external_id}",
        )
    if not menu_item.available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Item unavailable: {menu_item.name}",
        )
    unit_price = menu_item.price + _customization_price(menu_item, line.customizations)
    return menu_item, unit_price


def _recalculate_totals(order: Order) -> None:
    subtotal = sum(item.subtotal for item in order.items)
    cgst, sgst, total = _calc_tax(subtotal)
    order.subtotal = subtotal
    order.cgst = cgst
    order.sgst = sgst
    order.total = total


async def _append_items(
    db: AsyncSession, order: Order, lines: list[OrderItemInput], cafe_id: int
) -> None:
    for line in lines:
        menu_item, unit_price = await _resolve_line(db, cafe_id, line)
        db.add(
            OrderItem(
                order_id=order.id,
                menu_item_id=menu_item.id,
                external_id=menu_item.external_id,
                name=menu_item.name,
                quantity=line.quantity,
                unit_price=unit_price,
                subtotal=unit_price * line.quantity,
                notes=line.notes,
                customizations=line.customizations,
                stock_deducted=False,
            )
        )
    await db.flush()
    await db.refresh(order, ["items"])
    _recalculate_totals(order)


async def _replace_items(
    db: AsyncSession, order: Order, lines: list[OrderItemInput], cafe_id: int
) -> None:
    await db.execute(delete(OrderItem).where(OrderItem.order_id == order.id))
    order.items.clear()
    await db.flush()
    await _append_items(db, order, lines, cafe_id)


def _order_to_response(order: Order) -> dict:
    return {
        "id": order.id,
        "order_number": order.order_number,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "customer_email": order.customer_email,
        "table_number": order.table_number,
        "notes": order.notes,
        "subtotal": order.subtotal,
        "cgst": order.cgst,
        "sgst": order.sgst,
        "total": order.total,
        "amount_paid": order.amount_paid,
        "balance_due": max(0, order.total - order.amount_paid),
        "upi_txn_last5": order.upi_txn_last5,
        "payment_status": order.payment_status.value,
        "order_status": order.order_status.value,
        "version": order.version,
        "items": [
            {
                "external_id": item.external_id,
                "name": item.name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "subtotal": item.subtotal,
                "notes": item.notes,
                "customizations": item.customizations or [],
            }
            for item in order.items
        ],
        "created_at": order.created_at.isoformat(),
    }


async def _emit(event: str, order: Order) -> None:
    await order_events.broadcast(
        {"event": event, "order_id": order.id, "order": _order_to_response(order)}
    )


async def get_order_by_id(db: AsyncSession, order_id: int) -> Order | None:
    result = await db.execute(
        select(Order).where(Order.id == order_id).options(selectinload(Order.items))
    )
    return result.scalar_one_or_none()


async def get_order_by_idempotency(db: AsyncSession, key: str) -> Order | None:
    result = await db.execute(
        select(Order).where(Order.idempotency_key == key).options(selectinload(Order.items))
    )
    return result.scalar_one_or_none()


async def create_order(
    db: AsyncSession,
    body: CreateOrderRequest,
    idempotency_key: str | None = None,
) -> Order:
    if idempotency_key:
        existing = await get_order_by_idempotency(db, idempotency_key)
        if existing:
            return existing

    cafe_id = settings.cafe_id
    await cafe_service.require_accepting_orders(db, cafe_id)
    subtotal = 0
    resolved_lines: list[tuple[MenuItem, OrderItemInput, int]] = []

    for line in body.items:
        menu_item, unit_price = await _resolve_line(db, cafe_id, line)
        subtotal += unit_price * line.quantity
        resolved_lines.append((menu_item, line, unit_price))

    cgst, sgst, total = _calc_tax(subtotal)
    order_number = await _next_order_number(db, cafe_id)

    from services import inventory_service

    await inventory_service.assert_stock_for_menu_quantities(
        db,
        cafe_id,
        [(menu_item.id, line.quantity) for menu_item, line, _ in resolved_lines],
        item_label="order",
    )

    order = Order(
        cafe_id=cafe_id,
        order_number=order_number,
        customer_name=body.customer_name.strip(),
        customer_phone=body.customer_phone,
        customer_email=str(body.customer_email) if body.customer_email else None,
        table_number=body.table_number,
        notes=body.notes,
        subtotal=subtotal,
        cgst=cgst,
        sgst=sgst,
        total=total,
        payment_status=PaymentStatus.PENDING,
        order_status=OrderStatus.PENDING_PAYMENT,
        idempotency_key=idempotency_key,
    )
    db.add(order)
    await db.flush()

    for menu_item, line, unit_price in resolved_lines:
        db.add(
            OrderItem(
                order_id=order.id,
                menu_item_id=menu_item.id,
                external_id=menu_item.external_id,
                name=menu_item.name,
                quantity=line.quantity,
                unit_price=unit_price,
                subtotal=unit_price * line.quantity,
                notes=line.notes,
                customizations=line.customizations,
            )
        )

    await db.commit()
    await db.refresh(order, ["items"])
    await _emit("ORDER_CREATED", order)
    return order


async def list_pos_orders(db: AsyncSession, cafe_id: int) -> list[Order]:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    unpaid_first = case((Order.order_status == OrderStatus.PENDING_PAYMENT, 0), else_=1)
    result = await db.execute(
        select(Order)
        .where(
            Order.cafe_id == cafe_id,
            or_(
                Order.order_status.notin_((OrderStatus.COMPLETED, OrderStatus.CANCELLED)),
                and_(
                    Order.order_status == OrderStatus.COMPLETED,
                    Order.created_at >= today_start,
                ),
            ),
        )
        .options(selectinload(Order.items))
        .order_by(unpaid_first, Order.created_at.asc())
    )
    return list(result.scalars().all())


async def _get_order_for_update(db: AsyncSession, order_id: int) -> Order | None:
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items))
        .with_for_update()
    )
    return result.scalar_one_or_none()


async def mark_order_paid(
    db: AsyncSession,
    order_id: int,
    staff: User,
    expected_version: int,
    upi_txn_last5: str | None = None,
) -> Order:
    order = await _get_order_for_update(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.version != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order was updated by another staff member. Refresh and try again.",
        )

    balance = max(0, order.total - order.amount_paid)

    if order.order_status == OrderStatus.PENDING_PAYMENT:
        if balance <= 0 and order.amount_paid > 0:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Nothing to pay")
        order.order_status = OrderStatus.PAID
        order.payment_status = PaymentStatus.PAID
        order.paid_at = datetime.now(timezone.utc)
        order.verified_by_user_id = staff.id
        order.amount_paid = order.total
        order.version += 1
        from services import inventory_service

        await inventory_service.deduct_for_order(db, order, staff.id)
    elif order.order_status in (OrderStatus.PAID, OrderStatus.IN_PREPARATION, OrderStatus.READY):
        if balance <= 0:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No additional payment due")
        order.amount_paid = order.total
        order.verified_by_user_id = staff.id
        order.version += 1
        from services import inventory_service

        await inventory_service.deduct_for_order(db, order, staff.id)
    else:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot mark paid from status {order.order_status.value}",
        )

    if upi_txn_last5:
        order.upi_txn_last5 = upi_txn_last5

    await db.commit()
    await db.refresh(order, ["items"])
    await _emit("ORDER_PAID", order)
    return order


async def cancel_order(db: AsyncSession, order_id: int, staff: User, expected_version: int) -> Order:
    order = await _get_order_for_update(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.version != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order was updated by another staff member. Refresh and try again.",
        )
    if order.order_status != OrderStatus.PENDING_PAYMENT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel from status {order.order_status.value}",
        )

    order.order_status = OrderStatus.CANCELLED
    order.payment_status = PaymentStatus.CANCELLED
    order.version += 1

    await db.commit()
    await db.refresh(order, ["items"])
    await _emit("ORDER_CANCELLED", order)
    return order


async def update_pending_order(
    db: AsyncSession,
    order_id: int,
    customer_name: str,
    customer_phone: str | None,
    table_number: str | None,
    notes: str | None,
    items: list[OrderItemInput],
    expected_version: int,
) -> Order:
    order = await _get_order_for_update(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.version != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order was updated by another staff member. Refresh and try again.",
        )
    if order.order_status != OrderStatus.PENDING_PAYMENT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only unpaid orders can be fully edited",
        )

    order.customer_name = customer_name.strip()
    order.customer_phone = customer_phone
    order.table_number = table_number
    order.notes = notes
    order.version += 1

    from services import inventory_service

    menu_quantities: list[tuple[int, int]] = []
    for line in items:
        menu_item, _ = await _resolve_line(db, settings.cafe_id, line)
        menu_quantities.append((menu_item.id, line.quantity))
    await inventory_service.assert_stock_for_menu_quantities(
        db, settings.cafe_id, menu_quantities, item_label="order update"
    )

    await _replace_items(db, order, items, settings.cafe_id)

    await db.commit()
    await db.refresh(order, ["items"])
    await _emit("ORDER_UPDATED", order)
    return order


async def add_items_to_order(
    db: AsyncSession,
    order_id: int,
    items: list[OrderItemInput],
    expected_version: int,
    staff: User | None = None,
) -> Order:
    order = await _get_order_for_update(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.version != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order was updated by another staff member. Refresh and try again.",
        )
    if order.order_status not in (OrderStatus.PAID, OrderStatus.IN_PREPARATION, OrderStatus.READY):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Items can only be added to paid in-progress orders",
        )

    from services import inventory_service

    menu_quantities: list[tuple[int, int]] = []
    for line in items:
        menu_item, _ = await _resolve_line(db, settings.cafe_id, line)
        menu_quantities.append((menu_item.id, line.quantity))
    await inventory_service.assert_stock_for_menu_quantities(
        db, settings.cafe_id, menu_quantities, item_label="added items"
    )

    order.version += 1
    await _append_items(db, order, items, settings.cafe_id)
    await inventory_service.deduct_for_order(db, order, staff.id if staff else None)

    await db.commit()
    await db.refresh(order, ["items"])
    await _emit("ORDER_UPDATED", order)
    return order


async def complete_order(db: AsyncSession, order_id: int, expected_version: int) -> Order:
    order = await _get_order_for_update(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.version != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order was updated by another staff member. Refresh and try again.",
        )
    if order.order_status not in (OrderStatus.PAID, OrderStatus.IN_PREPARATION, OrderStatus.READY):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot complete from status {order.order_status.value}",
        )
    if max(0, order.total - order.amount_paid) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Collect outstanding payment before completing the order",
        )

    order.order_status = OrderStatus.COMPLETED
    order.version += 1
    await db.commit()
    await db.refresh(order, ["items"])
    await _emit("ORDER_COMPLETED", order)
    return order


async def list_kitchen_orders(db: AsyncSession, cafe_id: int) -> list[Order]:
    kitchen_statuses = (OrderStatus.PAID, OrderStatus.IN_PREPARATION, OrderStatus.READY)
    result = await db.execute(
        select(Order)
        .where(Order.cafe_id == cafe_id, Order.order_status.in_(kitchen_statuses))
        .options(selectinload(Order.items))
        .order_by(Order.created_at.asc())
    )
    return list(result.scalars().all())


async def update_kitchen_status(
    db: AsyncSession, order_id: int, target: OrderStatus, expected_version: int
) -> Order:
    from schemas.kitchen import EVENT_FOR_STATUS, KITCHEN_TRANSITIONS

    order = await _get_order_for_update(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.version != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order was updated by another user. Refresh and try again.",
        )

    expected_next = KITCHEN_TRANSITIONS.get(order.order_status)
    if expected_next != target:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot move from {order.order_status.value} to {target.value}",
        )

    order.order_status = target
    order.version += 1
    await db.commit()
    await db.refresh(order, ["items"])

    event = EVENT_FOR_STATUS.get(target)
    if event:
        await _emit(event, order)
    return order
