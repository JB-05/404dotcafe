from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.deps import require_roles
from models import MenuItem, User, UserRole
from schemas.inventory import (
    InventoryItemCreate,
    InventoryItemResponse,
    InventoryItemUpdate,
    MenuRecipeResponse,
    RecipeUpdateRequest,
    StockAdjustRequest,
    StockAlertResponse,
)
from services import inventory_service

router = APIRouter(prefix="/inventory", tags=["inventory"])

AdminUser = Annotated[User, Depends(require_roles(UserRole.ADMIN))]


@router.get("/items", response_model=list[InventoryItemResponse])
async def get_inventory_items(db: Annotated[AsyncSession, Depends(get_db)], _: AdminUser):
    items = await inventory_service.list_inventory_items(db, settings.cafe_id)
    return [inventory_service.item_to_dict(i) for i in items]


@router.post("/items", response_model=InventoryItemResponse)
async def create_item(
    body: InventoryItemCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    item = await inventory_service.create_inventory_item(db, settings.cafe_id, body)
    return inventory_service.item_to_dict(item)


@router.patch("/items/{item_id}", response_model=InventoryItemResponse)
async def update_item(
    item_id: int,
    body: InventoryItemUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    item = await inventory_service.update_inventory_item(db, item_id, body)
    return inventory_service.item_to_dict(item)


@router.post("/adjust", response_model=InventoryItemResponse)
async def adjust_inventory(
    body: StockAdjustRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    staff: AdminUser,
):
    item = await inventory_service.adjust_stock(
        db,
        settings.cafe_id,
        body.inventory_item_id,
        body.quantity_change,
        body.reason,
        staff.id,
        body.notes,
    )
    return inventory_service.item_to_dict(item)


@router.get("/alerts", response_model=list[StockAlertResponse])
async def get_stock_alerts(db: Annotated[AsyncSession, Depends(get_db)], _: AdminUser):
    return await inventory_service.list_alerts(db, settings.cafe_id)


@router.get("/recipes", response_model=list[MenuRecipeResponse])
async def get_recipes(db: Annotated[AsyncSession, Depends(get_db)], _: AdminUser):
    return await inventory_service.list_recipes(db, settings.cafe_id)


@router.get("/menu-items")
async def get_menu_items_for_recipes(db: Annotated[AsyncSession, Depends(get_db)], _: AdminUser):
    result = await db.execute(
        select(MenuItem.id, MenuItem.name, MenuItem.external_id)
        .where(MenuItem.cafe_id == settings.cafe_id)
        .order_by(MenuItem.name.asc())
    )
    return [
        {"id": row.id, "name": row.name, "external_id": row.external_id}
        for row in result.all()
    ]


@router.put("/recipes/{menu_item_id}", response_model=MenuRecipeResponse)
async def set_recipe(
    menu_item_id: int,
    body: RecipeUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    return await inventory_service.update_recipe(db, settings.cafe_id, menu_item_id, body.lines)
