#!/usr/bin/env python3
"""Seed sample inventory ingredients and recipes for top menu items."""

import asyncio
import sys
from decimal import Decimal
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent
BACKEND = ROOT / "backend" if (ROOT / "backend" / "main.py").exists() else Path("/app")
sys.path.insert(0, str(BACKEND))

from sqlalchemy import select

from core.database import AsyncSessionLocal
from models import Cafe, InventoryItem, MenuItem, MenuItemRecipe, StockUnit

INGREDIENTS = [
    ("Burger Bun", StockUnit.PCS, 200, 30, 800),
    ("Chicken Patty", StockUnit.PCS, 80, 15, 4500),
    ("Veg Patty", StockUnit.PCS, 60, 12, 3500),
    ("Cheese Slice", StockUnit.PCS, 150, 25, 1200),
    ("Secret Sauce", StockUnit.G, 5000, 800, 50),
    ("Mojito Syrup", StockUnit.ML, 3000, 500, 30),
    ("Soda Water", StockUnit.ML, 10000, 1500, 5),
]

RECIPES = {
    "chicken-burger": [
        ("Burger Bun", 1),
        ("Chicken Patty", 1),
        ("Cheese Slice", 1),
        ("Secret Sauce", 20),
    ],
    "veg-burger": [
        ("Burger Bun", 1),
        ("Veg Patty", 1),
        ("Cheese Slice", 1),
        ("Secret Sauce", 20),
    ],
    "mojito-ultra": [
        ("Mojito Syrup", 30),
        ("Soda Water", 200),
    ],
}


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Cafe).where(Cafe.slug == "404-cafe"))
        cafe = result.scalar_one_or_none()
        if not cafe:
            print("Run seed_menu.py first.")
            return

        name_to_item: dict[str, InventoryItem] = {}
        for name, unit, stock, threshold, cost in INGREDIENTS:
            existing = await db.execute(
                select(InventoryItem).where(
                    InventoryItem.cafe_id == cafe.id, InventoryItem.name == name
                )
            )
            item = existing.scalar_one_or_none()
            if not item:
                item = InventoryItem(
                    cafe_id=cafe.id,
                    name=name,
                    unit=unit,
                    current_stock=Decimal(stock),
                    threshold=Decimal(threshold),
                    cost_per_unit=cost,
                )
                db.add(item)
                await db.flush()
            name_to_item[name] = item

        for external_id, lines in RECIPES.items():
            menu_result = await db.execute(
                select(MenuItem).where(
                    MenuItem.cafe_id == cafe.id, MenuItem.external_id == external_id
                )
            )
            menu_item = menu_result.scalar_one_or_none()
            if not menu_item:
                continue

            existing_recipe = await db.execute(
                select(MenuItemRecipe).where(MenuItemRecipe.menu_item_id == menu_item.id)
            )
            if existing_recipe.scalars().first():
                continue

            for ing_name, qty in lines:
                db.add(
                    MenuItemRecipe(
                        menu_item_id=menu_item.id,
                        inventory_item_id=name_to_item[ing_name].id,
                        quantity_required=Decimal(qty),
                    )
                )

        await db.commit()
        print("Inventory seeded.")


if __name__ == "__main__":
    asyncio.run(seed())
