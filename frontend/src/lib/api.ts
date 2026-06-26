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

export function markOrderPaid(orderId: number, version: number) {
  return apiFetch<OrderResponse>(`/api/v1/pos/orders/${orderId}/payment`, {
    method: "PATCH",
    body: JSON.stringify({ version }),
  });
}

export function cancelPosOrder(orderId: number, version: number) {
  return apiFetch<OrderResponse>(`/api/v1/pos/orders/${orderId}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({ version }),
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

export function fetchAdminOverview() {
  return apiFetch<AdminOverview>("/api/v1/finance/overview");
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
