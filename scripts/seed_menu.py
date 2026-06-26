#!/usr/bin/env python3
"""Seed 404 Café menu and default admin user from scripts/legacy_menu.json"""

import asyncio
import json
import sys
from pathlib import Path

# Allow running from repo root or backend dir
ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from sqlalchemy import select

from core.database import AsyncSessionLocal
from core.security import hash_password
from models import Cafe, MenuCategory, MenuItem, User, UserRole

MENU_FILE = ROOT / "scripts" / "legacy_menu.json"

CATEGORY_MAP = {
    "burgers": ("Burgers", "burgers", 1),
    "drinks": ("Drinks", "drinks", 2),
    "desserts": ("Desserts", "desserts", 3),
    "extras": ("Add-ons", "addons", 4),
}

DEFAULT_USERS = [
    ("Admin", "admin@404cafe.in", "admin123", UserRole.ADMIN),
    ("POS Staff", "staff@404cafe.in", "staff123", UserRole.STAFF),
    ("Kitchen", "kitchen@404cafe.in", "kitchen123", UserRole.KITCHEN),
]


async def seed() -> None:
    if not MENU_FILE.exists():
        raise FileNotFoundError(f"Menu file not found: {MENU_FILE}")

    with open(MENU_FILE, encoding="utf-8") as f:
        menu_data = json.load(f)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Cafe).where(Cafe.slug == "404-cafe"))
        cafe = result.scalar_one_or_none()
        if not cafe:
            cafe = Cafe(id=1, name="404 Café", slug="404-cafe")
            db.add(cafe)
            await db.flush()

        categories: dict[str, MenuCategory] = {}
        for slug_key, (name, slug, order) in CATEGORY_MAP.items():
            result = await db.execute(
                select(MenuCategory).where(
                    MenuCategory.cafe_id == cafe.id, MenuCategory.slug == slug
                )
            )
            cat = result.scalar_one_or_none()
            if not cat:
                cat = MenuCategory(
                    cafe_id=cafe.id, name=name, slug=slug, display_order=order, active=True
                )
                db.add(cat)
                await db.flush()
            categories[slug_key] = cat

        for item in menu_data:
            cat = categories[item["category"]]
            result = await db.execute(
                select(MenuItem).where(
                    MenuItem.cafe_id == cafe.id,
                    MenuItem.external_id == item["itemId"],
                )
            )
            if result.scalar_one_or_none():
                continue

            image = item.get("image") or None
            image_url = f"/images/{image.split('/')[-1]}" if image else None

            db.add(
                MenuItem(
                    cafe_id=cafe.id,
                    category_id=cat.id,
                    external_id=item["itemId"],
                    name=item["name"],
                    description=item.get("desc"),
                    price=item["price"],
                    image_url=image_url,
                    veg=item.get("veg", True),
                    available=True,
                    prep_time=10,
                    customizations=item.get("customizations", []),
                )
            )

        for name, email, password, role in DEFAULT_USERS:
            result = await db.execute(select(User).where(User.email == email))
            if result.scalar_one_or_none():
                continue
            db.add(
                User(
                    cafe_id=cafe.id,
                    name=name,
                    email=email,
                    password_hash=hash_password(password),
                    role=role,
                    is_active=True,
                )
            )

        await db.commit()
        print("Seed complete: cafe, menu, and default users created.")


if __name__ == "__main__":
    asyncio.run(seed())
