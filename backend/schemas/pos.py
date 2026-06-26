from pydantic import BaseModel, Field, field_validator

from schemas.order import CreateOrderRequest, OrderItemInput


class OrderActionRequest(BaseModel):
    version: int = Field(ge=1)


class PaymentConfirmRequest(BaseModel):
    version: int = Field(ge=1)
    upi_txn_last5: str | None = Field(default=None, max_length=5)

    @field_validator("upi_txn_last5", mode="before")
    @classmethod
    def normalize_upi_ref(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        if len(text) != 5 or not text.isdigit():
            raise ValueError("UPI reference must be exactly 5 digits")
        return text


class PosUpdateOrderRequest(BaseModel):
    version: int = Field(ge=1)
    customer_name: str = Field(min_length=1, max_length=120)
    customer_phone: str | None = Field(default=None, max_length=20)
    table_number: str | None = Field(default=None, max_length=10)
    notes: str | None = None
    items: list[OrderItemInput] = Field(min_length=1)


class PosAddItemsRequest(BaseModel):
    version: int = Field(ge=1)
    items: list[OrderItemInput] = Field(min_length=1)


PosCreateOrderRequest = CreateOrderRequest
