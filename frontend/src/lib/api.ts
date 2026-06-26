import { authHeaders } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const body = await res.json();
      message = body.detail ?? message;
    } catch {
      const text = await res.text();
      if (text) message = text;
    }
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export type MenuItem = {
  id: number;
  external_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  veg: boolean;
  available: boolean;
  prep_time: number;
  customizations: { name: string; price: number }[];
};

export type MenuCategory = {
  id: number;
  name: string;
  slug: string;
  display_order: number;
  items: MenuItem[];
};

export type MenuResponse = {
  cafe_name: string;
  categories: MenuCategory[];
};

export type OrderItemPayload = {
  external_id: string;
  quantity: number;
  notes?: string;
  customizations?: string[];
};

export type CreateOrderPayload = {
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  table_number?: string;
  notes?: string;
  items: OrderItemPayload[];
};

export type OrderItemResponse = {
  external_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes: string | null;
  customizations: string[];
};

export type OrderResponse = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  table_number: string | null;
  notes: string | null;
  subtotal: number;
  cgst: number;
  sgst: number;
  total: number;
  payment_status: string;
  order_status: string;
  items: OrderItemResponse[];
  created_at: string;
  version?: number;
  amount_paid?: number;
  balance_due?: number;
  upi_txn_last5?: string | null;
};

export function fetchMenu() {
  return apiFetch<MenuResponse>("/api/v1/menu");
}

export function createOrder(payload: CreateOrderPayload, idempotencyKey?: string) {
  return apiFetch<OrderResponse>("/api/v1/orders", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export function fetchOrder(orderId: number) {
  return apiFetch<OrderResponse>(`/api/v1/orders/${orderId}`);
}

export type LoginResponse = {
  access_token: string;
  token_type: string;
  role: string;
  name: string;
};

export function login(email: string, password: string) {
  return apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchPosOrders() {
  return apiFetch<OrderResponse[]>("/api/v1/pos/orders");
}

export function markOrderPaid(orderId: number, version: number, upiTxnLast5?: string) {
  return apiFetch<OrderResponse>(`/api/v1/pos/orders/${orderId}/payment`, {
    method: "PATCH",
    body: JSON.stringify({
      version,
      ...(upiTxnLast5 ? { upi_txn_last5: upiTxnLast5 } : {}),
    }),
  });
}

export function cancelPosOrder(orderId: number, version: number) {
  return apiFetch<OrderResponse>(`/api/v1/pos/orders/${orderId}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({ version }),
  });
}

export function completePosOrder(orderId: number, version: number) {
  return apiFetch<OrderResponse>(`/api/v1/pos/orders/${orderId}/complete`, {
    method: "PATCH",
    body: JSON.stringify({ version }),
  });
}

export function createPosOrder(payload: CreateOrderPayload) {
  return apiFetch<OrderResponse>("/api/v1/pos/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePosOrder(
  orderId: number,
  payload: CreateOrderPayload & { version: number }
) {
  return apiFetch<OrderResponse>(`/api/v1/pos/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function addPosOrderItems(
  orderId: number,
  version: number,
  items: OrderItemPayload[]
) {
  return apiFetch<OrderResponse>(`/api/v1/pos/orders/${orderId}/items`, {
    method: "POST",
    body: JSON.stringify({ version, items }),
  });
}

export function fetchKitchenOrders() {
  return apiFetch<OrderResponse[]>("/api/v1/kitchen/orders");
}

export function advanceKitchenOrder(orderId: number, status: string, version: number) {
  return apiFetch<OrderResponse>(`/api/v1/kitchen/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, version }),
  });
}

export type InventoryItem = {
  id: number;
  name: string;
  unit: string;
  current_stock: number;
  threshold: number;
  cost_per_unit: number;
  alert_level: string;
};

export type StockAlert = InventoryItem;

export type RecipeLine = {
  inventory_item_id: number;
  inventory_item_name: string;
  unit: string;
  quantity_required: number;
};

export type MenuRecipe = {
  menu_item_id: number;
  menu_item_name: string;
  external_id: string;
  lines: RecipeLine[];
};

export type MenuCatalogItem = {
  id: number;
  external_id: string;
  name: string;
  category_name: string;
  category_slug: string;
  price: number;
  customizations: { name: string; price: number }[];
  lines: RecipeLine[];
};

export type FinanceSummary = {
  date: string;
  revenue: number;
  order_count: number;
  average_order_value: number;
  pending_orders: number;
  completed_orders: number;
  cogs: number;
  fixed_expenses: number;
  variable_expenses: number;
  gross_profit: number;
  net_profit: number;
  profit_margin_pct: number;
  break_even_sales: number | null;
  low_stock_count: number;
  hourly_sales: { hour: number; revenue: number; order_count: number }[];
  fixed_breakdown?: ExpenseLine[];
  variable_breakdown?: ExpenseLine[];
  item_sales?: ItemSalesProfit[];
};

export type ItemSalesProfit = {
  menu_item_id: number;
  name: string;
  quantity_sold: number;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: number;
  unit_cost: number;
};

export type MenuItemEconomics = {
  id: number;
  name: string;
  external_id: string;
  price: number;
  unit_cost: number;
  profit_per_unit: number;
  margin_pct: number;
  target_margin_pct: number;
  category_name?: string | null;
};

export type ExpenseLine = {
  name?: string | null;
  category?: string | null;
  amount: number;
  daily_amount?: number | null;
  billing_cycle?: string | null;
};

export type FixedExpense = {
  id: number;
  name: string;
  amount: number;
  billing_cycle: string;
  is_active: boolean;
  daily_amount: number;
};

export type VariableExpense = {
  id: number;
  expense_date: string;
  category: string;
  amount: number;
  notes: string | null;
};

export type AdminOverview = {
  summary: FinanceSummary;
  alerts: StockAlert[];
};

export type DailyTrendPoint = {
  date: string;
  revenue: number;
  order_count: number;
  completed_orders: number;
  average_order_value: number;
  cogs: number;
  fixed_expenses: number;
  variable_expenses: number;
  gross_profit: number;
  net_profit: number;
  profit_margin_pct: number;
  fixed_breakdown?: ExpenseLine[];
  variable_breakdown?: ExpenseLine[];
};

export type DailyTrend = {
  days: number;
  points: DailyTrendPoint[];
};

export type MonthlySummary = {
  year: number;
  month: number;
  label: string;
  days_in_month: number;
  revenue: number;
  completed_orders: number;
  average_order_value: number;
  cogs: number;
  fixed_expenses: number;
  variable_expenses: number;
  gross_profit: number;
  net_profit: number;
  profit_margin_pct: number;
  fixed_breakdown?: ExpenseLine[];
  variable_breakdown?: ExpenseLine[];
};

export type MonthlyTrend = {
  months: number;
  points: MonthlySummary[];
};

export type YearlySummary = {
  year: number;
  label: string;
  revenue: number;
  completed_orders: number;
  average_order_value: number;
  cogs: number;
  fixed_expenses: number;
  variable_expenses: number;
  gross_profit: number;
  net_profit: number;
  profit_margin_pct: number;
  fixed_breakdown?: ExpenseLine[];
  variable_breakdown?: ExpenseLine[];
};

export type YearlyTrend = {
  years: number;
  points: YearlySummary[];
};

export type ExpenseTimeline = {
  period: string;
  year?: number;
  month?: number;
  points: DailyTrendPoint[] | MonthlySummary[] | YearlySummary[];
};

export type CafeStatus = {
  is_open: boolean;
  session_id?: number | null;
  opened_at?: string | null;
  opened_by_user_id?: number | null;
  current_session_seconds: number;
};

export type CafeOperatingStats = {
  total_sessions: number;
  days_active: number;
  total_open_seconds: number;
  total_open_hours: number;
  is_open: boolean;
  current_session_seconds: number;
};

export type CafeSession = {
  id: number;
  opened_at: string;
  closed_at: string | null;
  opened_by_user_id: number;
  closed_by_user_id: number | null;
  duration_seconds: number;
  is_active: boolean;
};

export function fetchAdminOverview(date?: string) {
  const q = date ? `?date=${date}` : "";
  return apiFetch<AdminOverview>(`/api/v1/finance/overview${q}`);
}

export function fetchFinanceSummary(date?: string) {
  const q = date ? `?date=${date}` : "";
  return apiFetch<FinanceSummary>(`/api/v1/finance/summary${q}`);
}

export function computeFinanceSnapshot(date?: string) {
  const q = date ? `?date=${date}` : "";
  return apiFetch<{ snapshot_date: string; net_profit: number; revenue: number }>(
    `/api/v1/finance/snapshot${q}`,
    { method: "POST" }
  );
}

export function fetchDailyTrend(days = 30) {
  return apiFetch<DailyTrend>(`/api/v1/finance/daily-trend?days=${days}`);
}

export function fetchMonthlySummary(year: number, month: number) {
  return apiFetch<MonthlySummary>(`/api/v1/finance/monthly?year=${year}&month=${month}`);
}

export function fetchMonthlyTrend(months = 12) {
  return apiFetch<MonthlyTrend>(`/api/v1/finance/monthly-trend?months=${months}`);
}

export function fetchYearlySummary(year: number) {
  return apiFetch<YearlySummary>(`/api/v1/finance/yearly?year=${year}`);
}

export function fetchYearlyTrend(years = 5) {
  return apiFetch<YearlyTrend>(`/api/v1/finance/yearly-trend?years=${years}`);
}

export function fetchExpenseTimeline(period: "daily" | "monthly" | "yearly", year: number, month?: number) {
  const monthQ = month ? `&month=${month}` : "";
  return apiFetch<ExpenseTimeline>(`/api/v1/finance/expense-timeline?period=${period}&year=${year}${monthQ}`);
}

export function fetchCafeStatus() {
  return apiFetch<CafeStatus>("/api/v1/cafe/status");
}

export function openCafe() {
  return apiFetch<CafeStatus>("/api/v1/cafe/open", { method: "POST" });
}

export function closeCafe() {
  return apiFetch<CafeStatus>("/api/v1/cafe/close", { method: "POST" });
}

export function fetchCafeStats() {
  return apiFetch<CafeOperatingStats>("/api/v1/cafe/stats");
}

export function fetchCafeSessions(limit = 30) {
  return apiFetch<CafeSession[]>(`/api/v1/cafe/sessions?limit=${limit}`);
}

export function fetchMenuItemEconomics() {
  return apiFetch<MenuItemEconomics[]>("/api/v1/finance/menu-items");
}

export function updateMenuItemEconomics(
  menuItemId: number,
  payload: { unit_cost?: number; target_margin_pct?: number }
) {
  return apiFetch<MenuItemEconomics>(`/api/v1/finance/menu-items/${menuItemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchInventoryItems() {
  return apiFetch<InventoryItem[]>("/api/v1/inventory/items");
}

export function createInventoryItem(payload: {
  name: string;
  unit: string;
  current_stock: number;
  threshold: number;
  cost_per_unit: number;
}) {
  return apiFetch<InventoryItem>("/api/v1/inventory/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adjustInventory(payload: {
  inventory_item_id: number;
  quantity_change: number;
  reason: string;
  notes?: string;
}) {
  return apiFetch<InventoryItem>("/api/v1/inventory/adjust", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchInventoryAlerts() {
  return apiFetch<StockAlert[]>("/api/v1/inventory/alerts");
}

export function fetchRecipes() {
  return apiFetch<MenuRecipe[]>("/api/v1/inventory/recipes");
}

export function fetchMenuItemsForRecipes() {
  return apiFetch<{ id: number; name: string; external_id: string }[]>(
    "/api/v1/inventory/menu-items"
  );
}

export function fetchMenuCatalog() {
  return apiFetch<MenuCatalogItem[]>("/api/v1/inventory/menu-catalog");
}

export function saveMenuCatalogItem(
  menuItemId: number,
  payload: {
    price?: number;
    customizations?: { name: string; price: number }[];
    lines?: { inventory_item_id: number; quantity_required: number }[];
  }
) {
  return apiFetch<MenuCatalogItem>(`/api/v1/inventory/menu-catalog/${menuItemId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function updateRecipe(menuItemId: number, lines: { inventory_item_id: number; quantity_required: number }[]) {
  return apiFetch<MenuRecipe>(`/api/v1/inventory/recipes/${menuItemId}`, {
    method: "PUT",
    body: JSON.stringify({ lines }),
  });
}

export function fetchFixedExpenses() {
  return apiFetch<FixedExpense[]>("/api/v1/finance/fixed");
}

export function createFixedExpense(payload: {
  name: string;
  amount: number;
  billing_cycle: string;
}) {
  return apiFetch<FixedExpense>("/api/v1/finance/fixed", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateFixedExpense(
  id: number,
  payload: {
    name?: string;
    amount?: number;
    billing_cycle?: string;
  }
) {
  return apiFetch<FixedExpense>(`/api/v1/finance/fixed/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteFixedExpense(id: number) {
  return apiFetch<void>(`/api/v1/finance/fixed/${id}`, {
    method: "DELETE",
  });
}

export function fetchVariableExpenses(date?: string) {
  const q = date ? `?date=${date}` : "";
  return apiFetch<VariableExpense[]>(`/api/v1/finance/variable${q}`);
}

export function createVariableExpense(payload: {
  expense_date: string;
  category: string;
  amount: number;
  notes?: string;
}) {
  return apiFetch<VariableExpense>("/api/v1/finance/variable", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
