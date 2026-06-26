from pydantic import BaseModel


class CustomizationOption(BaseModel):
    name: str
    price: int


class MenuItemResponse(BaseModel):
    id: int
    external_id: str
    name: str
    description: str | None
    price: int
    image_url: str | None
    veg: bool
    available: bool
    prep_time: int
    customizations: list[CustomizationOption]

    model_config = {"from_attributes": True}


class MenuCategoryResponse(BaseModel):
    id: int
    name: str
    slug: str
    display_order: int
    items: list[MenuItemResponse]


class MenuResponse(BaseModel):
    cafe_name: str
    categories: list[MenuCategoryResponse]
