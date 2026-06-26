from pydantic import BaseModel, EmailStr, Field


class OrderItemInput(BaseModel):
    external_id: str = Field(min_length=1)
    quantity: int = Field(ge=1, le=99)
    notes: str | None = None
    customizations: list[str] = Field(default_factory=list)


class CreateOrderRequest(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    customer_phone: str | None = Field(default=None, max_length=20)
    customer_email: EmailStr | None = None
    table_number: str | None = Field(default=None, max_length=10)
    notes: str | None = None
    items: list[OrderItemInput] = Field(min_length=1)


class OrderItemResponse(BaseModel):
    external_id: str
    name: str
    quantity: int
    unit_price: int
    subtotal: int
    notes: str | None
    customizations: list[str]

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: int
    order_number: str
    customer_name: str
    customer_phone: str | None
    customer_email: str | None
    table_number: str | None
    notes: str | None
    subtotal: int
    cgst: int
    sgst: int
    total: int
    payment_status: str
    order_status: str
    version: int = 1
    items: list[OrderItemResponse]
    created_at: str

    model_config = {"from_attributes": True}
