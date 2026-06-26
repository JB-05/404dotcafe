from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import (
    BillingCycle,
    DailyFinancialSnapshot,
    FixedExpense,
    InventoryItem,
    MenuItem,
    MenuItemRecipe,
    Order,
    OrderItem,
    StockMovement,
    StockMovementReason,
)
from schemas.inventory import InventoryItemCreate, InventoryItemUpdate, RecipeLineInput


def alert_level(stock: Decimal, threshold: Decimal) -> str:
    if stock <= 0:
        return "OUT"
    if threshold <= 0:
        return "NORMAL"
    if stock <= threshold * Decimal("0.5"):
        return "CRITICAL"
    if stock <= threshold:
        return "LOW"
    return "NORMAL"


def item_to_dict(item: InventoryItem) -> dict:
    stock = Decimal(str(item.current_stock))
    thresh = Decimal(str(item.threshold))
    return {
        "id": item.id,
        "name": item.name,
        "unit": item.unit.value,
        "current_stock": float(stock),
        "threshold": float(thresh),
        "cost_per_unit": item.cost_per_unit,
        "alert_level": alert_level(stock, thresh),
    }


async def list_inventory_items(db: AsyncSession, cafe_id: int) -> list[InventoryItem]:
    result = await db.execute(
        select(InventoryItem)
        .where(InventoryItem.cafe_id == cafe_id)
        .order_by(InventoryItem.name.asc())
    )
    return list(result.scalars().all())


async def create_inventory_item(
    db: AsyncSession, cafe_id: int, body: InventoryItemCreate
) -> InventoryItem:
    item = InventoryItem(
        cafe_id=cafe_id,
        name=body.name.strip(),
        unit=body.unit,
        current_stock=body.current_stock,
        threshold=body.threshold,
        cost_per_unit=body.cost_per_unit,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_inventory_item(
    db: AsyncSession, item_id: int, body: InventoryItemUpdate
) -> InventoryItem:
    result = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found")

    if body.name is not None:
        item.name = body.name.strip()
    if body.threshold is not None:
        item.threshold = body.threshold
    if body.cost_per_unit is not None:
        item.cost_per_unit = body.cost_per_unit

    await db.commit()
    await db.refresh(item)
    return item


async def adjust_stock(
    db: AsyncSession,
    cafe_id: int,
    inventory_item_id: int,
    quantity_change: Decimal,
    reason: StockMovementReason,
    user_id: int | None,
    notes: str | None = None,
    reference_order_id: int | None = None,
) -> InventoryItem:
    result = await db.execute(
        select(InventoryItem)
        .where(InventoryItem.id == inventory_item_id, InventoryItem.cafe_id == cafe_id)
        .with_for_update()
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found")

    new_stock = Decimal(str(item.current_stock)) + quantity_change
    if new_stock < 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Insufficient stock for {item.name}",
        )

    item.current_stock = new_stock
    db.add(
        StockMovement(
            cafe_id=cafe_id,
            inventory_item_id=item.id,
            quantity_change=quantity_change,
            reason=reason,
            reference_order_id=reference_order_id,
            created_by_user_id=user_id,
            notes=notes,
        )
    )
    await db.flush()
    await _refresh_menu_availability(db, item.id)
    await db.commit()
    await db.refresh(item)
    return item


async def list_alerts(db: AsyncSession, cafe_id: int) -> list[dict]:
    items = await list_inventory_items(db, cafe_id)
    alerts = [item_to_dict(i) for i in items if alert_level(Decimal(str(i.current_stock)), Decimal(str(i.threshold))) != "NORMAL"]
    level_order = {"OUT": 0, "CRITICAL": 1, "LOW": 2}
    alerts.sort(key=lambda a: level_order.get(a["alert_level"], 9))
    return alerts


async def list_recipes(db: AsyncSession, cafe_id: int) -> list[dict]:
    result = await db.execute(
        select(MenuItem)
        .where(MenuItem.cafe_id == cafe_id)
        .options(selectinload(MenuItem.recipes).selectinload(MenuItemRecipe.inventory_item))
        .order_by(MenuItem.name.asc())
    )
    menu_items = result.scalars().unique().all()

    recipes: list[dict] = []
    for menu_item in menu_items:
        if not menu_item.recipes:
            continue
        recipes.append(
            {
                "menu_item_id": menu_item.id,
                "menu_item_name": menu_item.name,
                "external_id": menu_item.external_id,
                "lines": [
                    {
                        "inventory_item_id": line.inventory_item_id,
                        "inventory_item_name": line.inventory_item.name,
                        "unit": line.inventory_item.unit.value,
                        "quantity_required": float(line.quantity_required),
                    }
                    for line in menu_item.recipes
                ],
            }
        )
    return recipes


async def update_recipe(
    db: AsyncSession, cafe_id: int, menu_item_id: int, lines: list[RecipeLineInput]
) -> dict:
    result = await db.execute(
        select(MenuItem).where(MenuItem.id == menu_item_id, MenuItem.cafe_id == cafe_id)
    )
    menu_item = result.scalar_one_or_none()
    if not menu_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found")

    if lines:
        ids = {line.inventory_item_id for line in lines}
        inv_result = await db.execute(
            select(func.count(InventoryItem.id)).where(
                InventoryItem.cafe_id == cafe_id, InventoryItem.id.in_(ids)
            )
        )
        if inv_result.scalar_one() != len(ids):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ingredient id")

    await db.execute(delete(MenuItemRecipe).where(MenuItemRecipe.menu_item_id == menu_item_id))
    for line in lines:
        db.add(
            MenuItemRecipe(
                menu_item_id=menu_item_id,
                inventory_item_id=line.inventory_item_id,
                quantity_required=line.quantity_required,
            )
        )
    await db.commit()

    recipe_list = await list_recipes(db, cafe_id)
    for recipe in recipe_list:
        if recipe["menu_item_id"] == menu_item_id:
            return recipe
    return {
        "menu_item_id": menu_item.id,
        "menu_item_name": menu_item.name,
        "external_id": menu_item.external_id,
        "lines": [],
    }


async def deduct_for_order(db: AsyncSession, order: Order, user_id: int | None) -> None:
    for order_item in order.items:
        if not order_item.menu_item_id:
            continue
        recipe_result = await db.execute(
            select(MenuItemRecipe)
            .where(MenuItemRecipe.menu_item_id == order_item.menu_item_id)
            .options(selectinload(MenuItemRecipe.inventory_item))
        )
        for recipe in recipe_result.scalars().all():
            deduct_qty = Decimal(str(recipe.quantity_required)) * order_item.quantity
            inv = recipe.inventory_item
            new_stock = Decimal(str(inv.current_stock)) - deduct_qty
            if new_stock < 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Insufficient {inv.name} for order",
                )
            inv.current_stock = new_stock
            db.add(
                StockMovement(
                    cafe_id=order.cafe_id,
                    inventory_item_id=inv.id,
                    quantity_change=-deduct_qty,
                    reason=StockMovementReason.ORDER_FULFILLMENT,
                    reference_order_id=order.id,
                    created_by_user_id=user_id,
                )
            )
            await db.flush()
            await _refresh_menu_availability(db, inv.id)


async def _refresh_menu_availability(db: AsyncSession, inventory_item_id: int) -> None:
    result = await db.execute(
        select(MenuItemRecipe.menu_item_id).where(
            MenuItemRecipe.inventory_item_id == inventory_item_id
        )
    )
    menu_item_ids = [row[0] for row in result.all()]
    for menu_item_id in menu_item_ids:
        await _sync_menu_item_availability(db, menu_item_id)


async def _sync_menu_item_availability(db: AsyncSession, menu_item_id: int) -> None:
    result = await db.execute(
        select(MenuItemRecipe)
        .where(MenuItemRecipe.menu_item_id == menu_item_id)
        .options(selectinload(MenuItemRecipe.inventory_item))
    )
    recipes = result.scalars().all()
    if not recipes:
        return

    menu_result = await db.execute(select(MenuItem).where(MenuItem.id == menu_item_id))
    menu_item = menu_result.scalar_one_or_none()
    if not menu_item:
        return

    available = all(Decimal(str(r.inventory_item.current_stock)) > 0 for r in recipes)
    menu_item.available = available
