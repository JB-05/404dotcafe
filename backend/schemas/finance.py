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


class ExpenseCategoryLine(BaseModel):
    name: str | None = None
    category: str | None = None
    amount: int
    daily_amount: int | None = None
    billing_cycle: str | None = None


class ItemSalesProfit(BaseModel):
    menu_item_id: int
    name: str
    quantity_sold: int
    revenue: int
    cost: int
    profit: int
    margin_pct: float
    unit_cost: int


class MenuItemEconomicsResponse(BaseModel):
    id: int
    name: str
    external_id: str
    price: int
    unit_cost: int
    profit_per_unit: int
    margin_pct: float
    target_margin_pct: float
    category_name: str | None = None


class MenuItemEconomicsUpdate(BaseModel):
    unit_cost: int | None = Field(default=None, ge=0)
    target_margin_pct: float | None = Field(default=None, ge=0, le=100)


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
    fixed_breakdown: list[ExpenseCategoryLine] = []
    variable_breakdown: list[ExpenseCategoryLine] = []
    item_sales: list[ItemSalesProfit] = []


class AdminOverviewResponse(BaseModel):
    summary: FinanceSummaryResponse
    alerts: list[dict]


class DailyTrendPoint(BaseModel):
    date: str
    revenue: int
    order_count: int
    completed_orders: int
    average_order_value: int
    cogs: int
    fixed_expenses: int
    variable_expenses: int
    gross_profit: int
    net_profit: int
    profit_margin_pct: float
    fixed_breakdown: list[ExpenseCategoryLine] = []
    variable_breakdown: list[ExpenseCategoryLine] = []


class DailyTrendResponse(BaseModel):
    days: int
    points: list[DailyTrendPoint]


class MonthlySummaryResponse(BaseModel):
    year: int
    month: int
    label: str
    days_in_month: int
    revenue: int
    completed_orders: int
    average_order_value: int
    cogs: int
    fixed_expenses: int
    variable_expenses: int
    gross_profit: int
    net_profit: int
    profit_margin_pct: float
    fixed_breakdown: list[ExpenseCategoryLine] = []
    variable_breakdown: list[ExpenseCategoryLine] = []


class MonthlyTrendResponse(BaseModel):
    months: int
    points: list[MonthlySummaryResponse]


class YearlySummaryResponse(BaseModel):
    year: int
    label: str
    revenue: int
    completed_orders: int
    average_order_value: int
    cogs: int
    fixed_expenses: int
    variable_expenses: int
    gross_profit: int
    net_profit: int
    profit_margin_pct: float
    fixed_breakdown: list[ExpenseCategoryLine] = []
    variable_breakdown: list[ExpenseCategoryLine] = []


class YearlyTrendResponse(BaseModel):
    years: int
    points: list[YearlySummaryResponse]


class ExpenseTimelineResponse(BaseModel):
    period: str
    year: int | None = None
    month: int | None = None
    points: list[dict]
