import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class StockUnit(str, enum.Enum):
    KG = "kg"
    G = "g"
    PCS = "pcs"
    ML = "ml"
    L = "l"


class StockMovementReason(str, enum.Enum):
    ORDER_FULFILLMENT = "ORDER_FULFILLMENT"
    RESTOCK = "RESTOCK"
    SPOILAGE = "SPOILAGE"
    DAMAGE = "DAMAGE"
    CORRECTION = "CORRECTION"


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cafe_id: Mapped[int] = mapped_column(ForeignKey("cafes.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    unit: Mapped[StockUnit] = mapped_column(
        Enum(StockUnit, name="stock_unit", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    current_stock: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False, default=0)
    threshold: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False, default=0)
    cost_per_unit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    recipes: Mapped[list["MenuItemRecipe"]] = relationship(back_populates="inventory_item")


class MenuItemRecipe(Base):
    __tablename__ = "menu_item_recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    menu_item_id: Mapped[int] = mapped_column(
        ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity_required: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)

    menu_item: Mapped["MenuItem"] = relationship(back_populates="recipes")
    inventory_item: Mapped["InventoryItem"] = relationship(back_populates="recipes")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cafe_id: Mapped[int] = mapped_column(ForeignKey("cafes.id"), nullable=False, index=True)
    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity_change: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    reason: Mapped[StockMovementReason] = mapped_column(
        Enum(
            StockMovementReason,
            name="stock_movement_reason",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    reference_order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"))
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
