"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchMenuItemEconomics, updateMenuItemEconomics, type MenuItemEconomics } from "@/lib/api";

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

type EditState = {
  unit_cost: string;
  margin_pct: string;
};

export function MenuItemCosts() {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<number, EditState>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["menu-item-economics"],
    queryFn: fetchMenuItemEconomics,
  });

  const save = useMutation({
    mutationFn: ({
      id,
      unit_cost,
      target_margin_pct,
    }: {
      id: number;
      unit_cost?: number;
      target_margin_pct?: number;
    }) => updateMenuItemEconomics(id, { unit_cost, target_margin_pct }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-item-economics"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      queryClient.invalidateQueries({ queryKey: ["daily-trend"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-summary"] });
    },
  });

  const getEdit = (item: MenuItemEconomics): EditState =>
    edits[item.id] ?? {
      unit_cost: String(item.unit_cost),
      margin_pct: String(item.target_margin_pct),
    };

  const setEdit = (id: number, patch: Partial<EditState>) => {
    setEdits((prev) => {
      const item = items.find((i) => i.id === id);
      const base = item ? getEdit(item) : { unit_cost: "0", margin_pct: "0" };
      return { ...prev, [id]: { ...base, ...patch } };
    });
  };

  const saveCost = (item: MenuItemEconomics) => {
    const e = getEdit(item);
    const cost = parseInt(e.unit_cost, 10);
    if (Number.isNaN(cost) || cost < 0) return;
    save.mutate({ id: item.id, unit_cost: cost });
    setEdits((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  };

  const saveMargin = (item: MenuItemEconomics) => {
    const e = getEdit(item);
    const margin = parseFloat(e.margin_pct);
    if (Number.isNaN(margin) || margin < 0 || margin > 100) return;
    save.mutate({ id: item.id, target_margin_pct: margin });
    setEdits((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  };

  if (isLoading) return <p className="text-sm admin-muted">Loading menu items…</p>;

  return (
    <div className="admin-card overflow-x-auto">
      <p className="admin-card-title mb-1">Menu item costs & margins</p>
      <p className="text-xs admin-muted mb-3">
        Set cost per item or target margin — profit on the dashboard is calculated from sold quantities × unit cost.
      </p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Price</th>
            <th>Unit cost</th>
            <th>Margin %</th>
            <th>Profit/unit</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const e = getEdit(item);
            const costVal = parseInt(e.unit_cost, 10);
            const marginVal = parseFloat(e.margin_pct);
            const previewProfit =
              !Number.isNaN(costVal) && costVal >= 0 ? item.price - costVal : item.profit_per_unit;
            const dirty =
              e.unit_cost !== String(item.unit_cost) || e.margin_pct !== String(item.target_margin_pct);

            return (
              <tr key={item.id}>
                <td>
                  <p className="font-medium text-sm">{item.name}</p>
                  {item.category_name && (
                    <p className="text-xs admin-muted">{item.category_name}</p>
                  )}
                </td>
                <td>{fmt(item.price)}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={e.unit_cost}
                    onChange={(ev) => setEdit(item.id, { unit_cost: ev.target.value })}
                    className="admin-input w-20"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={e.margin_pct}
                    onChange={(ev) => setEdit(item.id, { margin_pct: ev.target.value })}
                    className="admin-input w-20"
                  />
                </td>
                <td className={previewProfit >= 0 ? "admin-positive" : "admin-negative"}>
                  {fmt(previewProfit)}
                </td>
                <td>
                  {dirty && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={save.isPending}
                        onClick={() => saveCost(item)}
                        className="admin-btn text-xs"
                        title="Save cost"
                      >
                        Save cost
                      </button>
                      <button
                        type="button"
                        disabled={save.isPending}
                        onClick={() => saveMargin(item)}
                        className="admin-btn admin-btn-primary text-xs"
                        title="Apply margin %"
                      >
                        Apply margin
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.length === 0 && <p className="text-sm admin-muted mt-2">No menu items found.</p>}
    </div>
  );
}

export function ItemSalesProfitTable({
  rows,
  title = "Item sales profit",
}: {
  rows: {
    name: string;
    quantity_sold: number;
    revenue: number;
    cost: number;
    profit: number;
    margin_pct: number;
  }[];
  title?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="admin-card overflow-x-auto">
      <p className="admin-card-title mb-3">{title}</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty sold</th>
            <th>Revenue</th>
            <th>Cost</th>
            <th>Profit</th>
            <th>Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="font-medium">{r.name}</td>
              <td>{r.quantity_sold}</td>
              <td>{fmt(r.revenue)}</td>
              <td>{fmt(r.cost)}</td>
              <td className={r.profit >= 0 ? "admin-positive" : "admin-negative"}>{fmt(r.profit)}</td>
              <td>{r.margin_pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
