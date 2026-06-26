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
    MenuCategory,
    MenuItem,
    MenuItemRecipe,
    Order,
    OrderItem,
    StockMovement,
    StockMovementReason,
)
from schemas.inventory import (
    CustomizationInput,
    InventoryItemCreate,
    InventoryItemUpdate,
    RecipeLineInput,
)


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


def _customizations_list(menu_item: MenuItem) -> list[dict]:
    raw = menu_item.customizations or []
    return [{"name": str(c.get("name", "")), "price": int(c.get("price") or 0)} for c in raw if c.get("name")]


def _recipe_lines_for_item(menu_item: MenuItem) -> list[dict]:
    return [
        {
            "inventory_item_id": line.inventory_item_id,
            "inventory_item_name": line.inventory_item.name,
            "unit": line.inventory_item.unit.value,
            "quantity_required": float(line.quantity_required),
        }
        for line in menu_item.recipes
    ]


def _catalog_item_dict(menu_item: MenuItem, category: MenuCategory) -> dict:
    return {
        "id": menu_item.id,
        "external_id": menu_item.external_id,
        "name": menu_item.name,
        "category_name": category.name,
        "category_slug": category.slug,
        "price": menu_item.price,
        "customizations": _customizations_list(menu_item),
        "lines": _recipe_lines_for_item(menu_item),
    }


async def list_menu_catalog(db: AsyncSession, cafe_id: int) -> list[dict]:
    result = await db.execute(
        select(MenuItem, MenuCategory)
        .join(MenuCategory, MenuCategory.id == MenuItem.category_id)
        .where(MenuItem.cafe_id == cafe_id)
        .options(selectinload(MenuItem.recipes).selectinload(MenuItemRecipe.inventory_item))
        .order_by(MenuCategory.display_order.asc(), MenuItem.name.asc())
    )
    return [_catalog_item_dict(item, cat) for item, cat in result.all()]


async def save_menu_item_catalog(
    db: AsyncSession,
    cafe_id: int,
    menu_item_id: int,
    *,
    price: int | None = None,
    customizations: list[CustomizationInput] | None = None,
    lines: list[RecipeLineInput] | None = None,
) -> dict:
    result = await db.execute(
        select(MenuItem, MenuCategory)
        .join(MenuCategory, MenuCategory.id == MenuItem.category_id)
        .where(MenuItem.id == menu_item_id, MenuItem.cafe_id == cafe_id)
        .options(selectinload(MenuItem.recipes).selectinload(MenuItemRecipe.inventory_item))
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found")
    menu_item, category = row

    if price is not None:
        menu_item.price = price
    if customizations is not None:
        menu_item.customizations = [{"name": c.name.strip(), "price": c.price} for c in customizations]

    if lines is not None:
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
    await db.refresh(menu_item, ["recipes"])
    result = await db.execute(
        select(MenuItem, MenuCategory)
        .join(MenuCategory, MenuCategory.id == MenuItem.category_id)
        .where(MenuItem.id == menu_item_id)
        .options(selectinload(MenuItem.recipes).selectinload(MenuItemRecipe.inventory_item))
    )
    item, cat = result.one()
    return _catalog_item_dict(item, cat)


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
                "lines": _recipe_lines_for_item(menu_item),
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


async def _stock_needs_for_menu_item(
    db: AsyncSession, menu_item_id: int, quantity: int
) -> dict[int, Decimal]:
    needs: dict[int, Decimal] = {}
    if quantity <= 0:
        return needs
    result = await db.execute(
        select(MenuItemRecipe).where(MenuItemRecipe.menu_item_id == menu_item_id)
    )
    for recipe in result.scalars().all():
        qty = Decimal(str(recipe.quantity_required)) * quantity
        needs[recipe.inventory_item_id] = needs.get(recipe.inventory_item_id, Decimal(0)) + qty
    return needs


async def _stock_needs_for_order_items(
    db: AsyncSession, order_items: list[OrderItem], *, only_undeducted: bool = False
) -> dict[int, Decimal]:
    needs: dict[int, Decimal] = {}
    for order_item in order_items:
        if only_undeducted and order_item.stock_deducted:
            continue
        if not order_item.menu_item_id:
            continue
        item_needs = await _stock_needs_for_menu_item(db, order_item.menu_item_id, order_item.quantity)
        for inv_id, qty in item_needs.items():
            needs[inv_id] = needs.get(inv_id, Decimal(0)) + qty
    return needs


async def _stock_needs_for_menu_quantities(
    db: AsyncSession, items: list[tuple[int, int]]
) -> dict[int, Decimal]:
    needs: dict[int, Decimal] = {}
    for menu_item_id, quantity in items:
        item_needs = await _stock_needs_for_menu_item(db, menu_item_id, quantity)
        for inv_id, qty in item_needs.items():
            needs[inv_id] = needs.get(inv_id, Decimal(0)) + qty
    return needs


async def assert_stock_for_menu_quantities(
    db: AsyncSession,
    cafe_id: int,
    items: list[tuple[int, int]],
    *,
    item_label: str | None = None,
) -> None:
    needs = await _stock_needs_for_menu_quantities(db, items)
    await assert_sufficient_stock(db, cafe_id, needs, item_label=item_label)


async def assert_sufficient_stock(
    db: AsyncSession, cafe_id: int, needs: dict[int, Decimal], *, item_label: str | None = None
) -> None:
    if not needs:
        return
    for inv_id, required in needs.items():
        if required <= 0:
            continue
        result = await db.execute(
            select(InventoryItem)
            .where(InventoryItem.id == inv_id, InventoryItem.cafe_id == cafe_id)
            .with_for_update()
        )
        inv = result.scalar_one_or_none()
        if not inv:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipe ingredient not found")
        available = Decimal(str(inv.current_stock))
        if available < required:
            label = item_label or inv.name
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Insufficient {inv.name} for {label} (need {required}, have {available})",
            )


async def _apply_stock_change(
    db: AsyncSession,
    cafe_id: int,
    inventory_item_id: int,
    quantity_change: Decimal,
    reason: StockMovementReason,
    user_id: int | None,
    reference_order_id: int | None = None,
    notes: str | None = None,
) -> None:
    result = await db.execute(
        select(InventoryItem)
        .where(InventoryItem.id == inventory_item_id, InventoryItem.cafe_id == cafe_id)
        .with_for_update()
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found")

    new_stock = Decimal(str(inv.current_stock)) + quantity_change
    if new_stock < 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Insufficient stock for {inv.name}",
        )

    inv.current_stock = new_stock
    db.add(
        StockMovement(
            cafe_id=cafe_id,
            inventory_item_id=inv.id,
            quantity_change=quantity_change,
            reason=reason,
            reference_order_id=reference_order_id,
            created_by_user_id=user_id,
            notes=notes,
        )
    )
    await db.flush()
    await _refresh_menu_availability(db, inv.id)


async def _deduct_order_item(
    db: AsyncSession, order: Order, order_item: OrderItem, user_id: int | None
) -> None:
    if not order_item.menu_item_id or order_item.stock_deducted:
        return

    recipe_result = await db.execute(
        select(MenuItemRecipe)
        .where(MenuItemRecipe.menu_item_id == order_item.menu_item_id)
        .options(selectinload(MenuItemRecipe.inventory_item))
    )
    for recipe in recipe_result.scalars().all():
        deduct_qty = Decimal(str(recipe.quantity_required)) * order_item.quantity
        await _apply_stock_change(
            db,
            order.cafe_id,
            recipe.inventory_item_id,
            -deduct_qty,
            StockMovementReason.ORDER_FULFILLMENT,
            user_id,
            reference_order_id=order.id,
        )
    order_item.stock_deducted = True


async def deduct_for_order(db: AsyncSession, order: Order, user_id: int | None) -> None:
    pending = [item for item in order.items if item.menu_item_id and not item.stock_deducted]
    if not pending:
        return
    needs = await _stock_needs_for_order_items(db, pending)
    await assert_sufficient_stock(
        db, order.cafe_id, needs, item_label=f"order {order.order_number}"
    )
    for order_item in pending:
        await _deduct_order_item(db, order, order_item, user_id)


async def restore_for_order_item(
    db: AsyncSession, order: Order, order_item: OrderItem, user_id: int | None
) -> None:
    if not order_item.menu_item_id or not order_item.stock_deducted:
        return

    recipe_result = await db.execute(
        select(MenuItemRecipe).where(MenuItemRecipe.menu_item_id == order_item.menu_item_id)
    )
    for recipe in recipe_result.scalars().all():
        restore_qty = Decimal(str(recipe.quantity_required)) * order_item.quantity
        await _apply_stock_change(
            db,
            order.cafe_id,
            recipe.inventory_item_id,
            restore_qty,
            StockMovementReason.CORRECTION,
            user_id,
            reference_order_id=order.id,
            notes=f"Restored from order {order.order_number}",
        )
    order_item.stock_deducted = False


async def restore_for_order(db: AsyncSession, order: Order, user_id: int | None) -> None:
    for order_item in order.items:
        await restore_for_order_item(db, order, order_item, user_id)


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
