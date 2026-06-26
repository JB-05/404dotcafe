from pydantic import BaseModel, Field


class OrderActionRequest(BaseModel):
    version: int = Field(ge=1)
