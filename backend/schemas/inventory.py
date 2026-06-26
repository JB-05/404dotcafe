from decimal import Decimal

from pydantic import BaseModel, Field

from models import StockMovementReason, StockUnit


class InventoryItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    unit: StockUnit
    current_stock: Decimal = Field(default=Decimal("0"), ge=0)
    threshold: Decimal = Field(default=Decimal("0"), ge=0)
    cost_per_unit: int = Field(default=0, ge=0)


class InventoryItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    threshold: Decimal | None = Field(default=None, ge=0)
    cost_per_unit: int | None = Field(default=None, ge=0)


class InventoryItemResponse(BaseModel):
    id: int
    name: str
    unit: str
    current_stock: float
    threshold: float
    cost_per_unit: int
    alert_level: str

    model_config = {"from_attributes": True}


class StockAdjustRequest(BaseModel):
    inventory_item_id: int
    quantity_change: Decimal = Field(description="Positive to add, negative to deduct")
    reason: StockMovementReason
    notes: str | None = None


class RecipeLineInput(BaseModel):
    inventory_item_id: int
    quantity_required: Decimal = Field(gt=0)


class RecipeUpdateRequest(BaseModel):
    lines: list[RecipeLineInput] = Field(default_factory=list)


class RecipeLineResponse(BaseModel):
    inventory_item_id: int
    inventory_item_name: str
    unit: str
    quantity_required: float


class MenuRecipeResponse(BaseModel):
    menu_item_id: int
    menu_item_name: str
    external_id: str
    lines: list[RecipeLineResponse]


class CustomizationInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    price: int = Field(ge=0)


class AdminMenuCatalogItem(BaseModel):
    id: int
    external_id: str
    name: str
    category_name: str
    category_slug: str
    price: int
    customizations: list[CustomizationInput]
    lines: list[RecipeLineResponse]


class AdminMenuItemUpdate(BaseModel):
    price: int | None = Field(default=None, ge=0)
    customizations: list[CustomizationInput] | None = None


class AdminMenuItemSaveRequest(BaseModel):
    price: int | None = Field(default=None, ge=0)
    customizations: list[CustomizationInput] | None = None
    lines: list[RecipeLineInput] = Field(default_factory=list)


class StockAlertResponse(BaseModel):
    id: int
    name: str
    unit: str
    current_stock: float
    threshold: float
    alert_level: str
