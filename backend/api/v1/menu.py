from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from repositories.menu_repo import get_menu_for_cafe
from schemas.menu import MenuCategoryResponse, MenuItemResponse, MenuResponse

router = APIRouter(prefix="/menu", tags=["menu"])


@router.get("", response_model=MenuResponse)
async def get_menu(db: Annotated[AsyncSession, Depends(get_db)]):
    categories = await get_menu_for_cafe(db, settings.cafe_id)
    return MenuResponse(
        cafe_name=settings.cafe_name,
        categories=[
            MenuCategoryResponse(
                id=cat.id,
                name=cat.name,
                slug=cat.slug,
                display_order=cat.display_order,
                items=[
                    MenuItemResponse(
                        id=item.id,
                        external_id=item.external_id,
                        name=item.name,
                        description=item.description,
                        price=item.price,
                        image_url=item.image_url,
                        veg=item.veg,
                        available=item.available,
                        prep_time=item.prep_time,
                        customizations=item.customizations or [],
                    )
                    for item in cat.items
                ],
            )
            for cat in categories
        ],
    )
