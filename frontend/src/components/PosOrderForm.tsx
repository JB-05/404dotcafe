"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  fetchMenu,
  type CreateOrderPayload,
  type MenuCategory,
  type MenuItem,
  type OrderResponse,
} from "@/lib/api";

export type PosLine = {
  external_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  customizations: string[];
  notes?: string;
};

type Mode = "create" | "edit" | "add";

type Props = {
  mode: Mode;
  order?: OrderResponse;
  onClose: () => void;
  onSubmit: (payload: CreateOrderPayload, version?: number) => void;
  busy: boolean;
  ordersDisabled?: boolean;
};

function calcTotal(lines: PosLine[]) {
  return lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
}

function calcTax(subtotal: number) {
  const cgst = Math.round(subtotal * 0.025);
  const sgst = Math.round(subtotal * 0.025);
  return { cgst, sgst, total: subtotal + cgst + sgst };
}

function lineKey(externalId: string, customizations: string[]) {
  return `${externalId}:${customizations.slice().sort().join(",")}`;
}

function addLineToCart(lines: PosLine[], item: MenuItem, qty: number, customizations: string[]) {
  const extra = item.customizations
    .filter((c) => customizations.includes(c.name))
    .reduce((s, c) => s + c.price, 0);
  const unitPrice = item.price + extra;
  const key = lineKey(item.external_id, customizations);
  const idx = lines.findIndex((l) => lineKey(l.external_id, l.customizations) === key);
  if (idx >= 0) {
    const next = [...lines];
    next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
    return next;
  }
  return [
    ...lines,
    {
      external_id: item.external_id,
      name: item.name,
      quantity: qty,
      unit_price: unitPrice,
      customizations,
    },
  ];
}

export function PosOrderForm({ mode, order, onClose, onSubmit, busy, ordersDisabled }: Props) {
  const { data: menu, isLoading } = useQuery({ queryKey: ["menu"], queryFn: fetchMenu });

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PosLine[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);
  const [pickQty, setPickQty] = useState(1);
  const [pickCustom, setPickCustom] = useState<string[]>([]);

  const categories = useMemo(
    () => menu?.categories.filter((c) => c.items.some((i) => i.available)) ?? [],
    [menu]
  );

  useEffect(() => {
    if (categories.length && !activeCategory) {
      setActiveCategory(categories[0].slug);
    }
  }, [categories, activeCategory]);

  useEffect(() => {
    if (mode === "create") return;
    if (mode === "edit" && order) {
      setCustomerName(order.customer_name);
      setCustomerPhone(order.customer_phone ?? "");
      setTableNumber(order.table_number ?? "");
      setNotes(order.notes ?? "");
      setLines(
        order.items.map((i) => ({
          external_id: i.external_id,
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          customizations: i.customizations ?? [],
          notes: i.notes ?? undefined,
        }))
      );
    }
    if (mode === "add") setLines([]);
  }, [mode, order]);

  const activeItems = useMemo(() => {
    const cat = categories.find((c) => c.slug === activeCategory);
    return cat?.items.filter((i) => i.available) ?? [];
  }, [categories, activeCategory]);

  const subtotal = calcTotal(lines);
  const { cgst, sgst, total } = calcTax(subtotal);
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);

  const title =
    mode === "create" ? "New order" : mode === "edit" ? "Edit order" : "Add items";

  const handleItemTap = (item: MenuItem) => {
    if (item.customizations.length > 0) {
      setCustomizing(item);
      setPickQty(1);
      setPickCustom([]);
      return;
    }
    setLines((prev) => addLineToCart(prev, item, 1, []));
  };

  const confirmCustomize = () => {
    if (!customizing) return;
    setLines((prev) => addLineToCart(prev, customizing, pickQty, pickCustom));
    setCustomizing(null);
    setPickQty(1);
    setPickCustom([]);
  };

  const updateLineQty = (index: number, delta: number) => {
    setLines((prev) => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) return prev.filter((_, i) => i !== index);
      next[index] = { ...next[index], quantity: newQty };
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) return;
    const payload: CreateOrderPayload = {
      customer_name: customerName.trim() || (mode === "add" ? order!.customer_name : "Walk-in"),
      customer_phone: customerPhone || undefined,
      table_number: tableNumber || undefined,
      notes: notes || undefined,
      items: lines.map((l) => ({
        external_id: l.external_id,
        quantity: l.quantity,
        customizations: l.customizations,
        notes: l.notes,
      })),
    };
    if (mode === "add") onSubmit(payload, order?.version);
    else if (mode === "edit") onSubmit(payload, order?.version);
    else onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col pos-form-shell" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col h-full w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {mode === "add" && order && (
              <p className="text-xs pos-muted">
                {order.order_number} · {order.customer_name} · ₹{order.total}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pos-btn w-9 h-9 flex items-center justify-center p-0"
          >
            ×
          </button>
        </header>

        {ordersDisabled && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
            Cafe is closed — new orders cannot be created.
          </div>
        )}

        <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
          <section className="flex flex-col flex-1 min-h-0 border-b lg:border-b-0 lg:border-r border-slate-200">
            {isLoading && <p className="p-4 pos-muted text-sm">Loading menu…</p>}

            {!isLoading && categories.length > 0 && (
              <>
                <div className="flex gap-1.5 px-3 py-2 overflow-x-auto shrink-0 bg-white border-b border-slate-100">
                  {categories.map((cat: MenuCategory) => (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => setActiveCategory(cat.slug)}
                      className={`pos-tab shrink-0 ${activeCategory === cat.slug ? "active" : ""}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  <div className="grid gap-2 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                    {activeItems.map((item) => (
                      <button
                        key={item.external_id}
                        type="button"
                        onClick={() => handleItemTap(item)}
                        className="pos-menu-item"
                      >
                        <div className="flex justify-between gap-2 items-start">
                          <p className="font-medium text-sm leading-snug">{item.name}</p>
                          <p className="font-bold text-sm shrink-0">₹{item.price}</p>
                        </div>
                        {item.customizations.length > 0 && (
                          <p className="text-[10px] pos-muted mt-1">Customize</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>

          <aside className="w-full lg:w-80 xl:w-96 flex flex-col shrink-0 bg-white border-l border-slate-200">
            {mode !== "add" && (
              <div className="p-3 space-y-2 border-b border-slate-100 shrink-0">
                <input
                  placeholder="Customer (optional — Walk-in)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="pos-input"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Table"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="pos-input"
                  />
                  <input
                    placeholder="Phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="pos-input"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 min-h-[100px]">
              <p className="text-xs font-medium pos-muted mb-2 uppercase tracking-wide">
                Cart · {itemCount} items
              </p>
              {lines.length === 0 ? (
                <p className="text-sm pos-muted">Tap items to add</p>
              ) : (
                <ul className="space-y-2">
                  {lines.map((line, i) => (
                    <li
                      key={i}
                      className="flex justify-between items-center gap-2 py-2 border-b border-slate-100 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{line.name}</p>
                        {line.customizations.length > 0 && (
                          <p className="text-xs pos-muted truncate">
                            {line.customizations.join(", ")}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            type="button"
                            onClick={() => updateLineQty(i, -1)}
                            className="pos-btn w-7 h-7 p-0 flex items-center justify-center text-sm"
                          >
                            −
                          </button>
                          <span className="text-sm font-semibold w-5 text-center">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateLineQty(i, 1)}
                            className="pos-btn w-7 h-7 p-0 flex items-center justify-center text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-bold shrink-0">₹{line.unit_price * line.quantity}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 space-y-2 shrink-0 bg-slate-50">
              {lines.length > 0 && (
                <div className="text-xs pos-muted space-y-0.5">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>₹{cgst + sgst}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center gap-3 pt-1">
                <p className="text-2xl font-bold">₹{total}</p>
                <button
                  type="submit"
                  disabled={busy || ordersDisabled || lines.length === 0}
                  className="pos-btn pos-btn-success pos-btn-lg min-w-[140px]"
                >
                  {busy
                    ? "Saving…"
                    : mode === "create"
                      ? "Create order"
                      : mode === "edit"
                        ? "Save"
                        : "Add items"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </form>

      {customizing && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => setCustomizing(null)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-sm p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{customizing.name}</h3>
                <p className="text-sm pos-muted">₹{customizing.price}</p>
              </div>
              <button type="button" onClick={() => setCustomizing(null)} className="pos-btn w-8 h-8 p-0">
                ×
              </button>
            </div>

            {customizing.customizations.length > 0 && (
              <div className="space-y-2">
                {customizing.customizations.map((c) => (
                  <label
                    key={c.name}
                    className="flex items-center justify-between gap-2 text-sm cursor-pointer py-1"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={pickCustom.includes(c.name)}
                        onChange={() =>
                          setPickCustom((prev) =>
                            prev.includes(c.name)
                              ? prev.filter((x) => x !== c.name)
                              : [...prev, c.name]
                          )
                        }
                      />
                      {c.name}
                    </span>
                    {c.price > 0 && <span className="pos-muted">+₹{c.price}</span>}
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPickQty((q) => Math.max(1, q - 1))}
                  className="pos-btn w-8 h-8 p-0"
                >
                  −
                </button>
                <span className="font-semibold w-6 text-center">{pickQty}</span>
                <button
                  type="button"
                  onClick={() => setPickQty((q) => Math.min(99, q + 1))}
                  className="pos-btn w-8 h-8 p-0"
                >
                  +
                </button>
              </div>
              <button type="button" onClick={confirmCustomize} className="pos-btn pos-btn-primary">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
