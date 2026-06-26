from datetime import date

from pydantic import BaseModel, Field

from models import BillingCycle


class FixedExpenseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    amount: int = Field(gt=0, description="Amount in paise")
    billing_cycle: BillingCycle


class FixedExpenseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    amount: int | None = Field(default=None, gt=0)
    billing_cycle: BillingCycle | None = None
    is_active: bool | None = None


class FixedExpenseResponse(BaseModel):
    id: int
    name: str
    amount: int
    billing_cycle: str
    is_active: bool
    daily_amount: int

    model_config = {"from_attributes": True}


class VariableExpenseCreate(BaseModel):
    expense_date: date
    category: str = Field(min_length=1, max_length=80)
    amount: int = Field(gt=0)
    notes: str | None = None


class VariableExpenseResponse(BaseModel):
    id: int
    expense_date: str
    category: str
    amount: int
    notes: str | None

    model_config = {"from_attributes": True}


class HourlySalesPoint(BaseModel):
    hour: int
    revenue: int
    order_count: int


class FinanceSummaryResponse(BaseModel):
    date: str
    revenue: int
    order_count: int
    average_order_value: int
    pending_orders: int
    completed_orders: int
    cogs: int
    fixed_expenses: int
    variable_expenses: int
    gross_profit: int
    net_profit: int
    profit_margin_pct: float
    break_even_sales: int | None
    low_stock_count: int
    hourly_sales: list[HourlySalesPoint]


class AdminOverviewResponse(BaseModel):
    summary: FinanceSummaryResponse
    alerts: list[dict]
