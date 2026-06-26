from pydantic import BaseModel, Field

from models import OrderStatus


class KitchenStatusUpdate(BaseModel):
    status: OrderStatus
    version: int = Field(ge=1)


KITCHEN_TRANSITIONS: dict[OrderStatus, OrderStatus] = {
    OrderStatus.PAID: OrderStatus.IN_PREPARATION,
    OrderStatus.IN_PREPARATION: OrderStatus.READY,
    OrderStatus.READY: OrderStatus.COMPLETED,
}

EVENT_FOR_STATUS: dict[OrderStatus, str] = {
    OrderStatus.IN_PREPARATION: "ORDER_STARTED",
    OrderStatus.READY: "ORDER_READY",
    OrderStatus.COMPLETED: "ORDER_COMPLETED",
}
