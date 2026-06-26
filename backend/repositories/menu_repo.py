from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import MenuCategory


async def get_menu_for_cafe(db: AsyncSession, cafe_id: int) -> list[MenuCategory]:
    result = await db.execute(
        select(MenuCategory)
        .where(MenuCategory.cafe_id == cafe_id, MenuCategory.active.is_(True))
        .options(selectinload(MenuCategory.items))
        .order_by(MenuCategory.display_order)
    )
    categories = result.scalars().all()
    for category in categories:
        category.items.sort(key=lambda i: i.name)
    return list(categories)
