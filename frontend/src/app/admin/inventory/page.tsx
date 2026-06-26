"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  adjustInventory,
  createInventoryItem,
  fetchInventoryItems,
  fetchMenuItemsForRecipes,
  fetchRecipes,
  updateRecipe,
  type InventoryItem,
} from "@/lib/api";

const UNITS = ["pcs", "g", "kg", "ml", "l"];
const REASONS = ["RESTOCK", "SPOILAGE", "DAMAGE", "CORRECTION"];

function alertClass(level: string) {
  if (level === "OUT") return "text-red-700";
  if (level === "CRITICAL") return "text-amber-700";
  if (level === "LOW") return "text-amber-600";
  return "text-green-700";
}

export default function AdminInventoryPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"ingredients" | "recipes">("ingredients");
  const [newItem, setNewItem] = useState({
    name: "",
    unit: "pcs",
    current_stock: 0,
    threshold: 0,
    cost_per_unit: 0,
  });
  const [adjustId, setAdjustId] = useState<number | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("RESTOCK");
  const [recipeMenuId, setRecipeMenuId] = useState<number | "">("");
  const [recipeLines, setRecipeLines] = useState<{ inventory_item_id: number; quantity_required: string }[]>([]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: fetchInventoryItems,
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ["inventory-recipes"],
    queryFn: fetchRecipes,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ["inventory-menu-items"],
    queryFn: fetchMenuItemsForRecipes,
  });

  const createItem = useMutation({
    mutationFn: () => createInventoryItem(newItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      setNewItem({ name: "", unit: "pcs", current_stock: 0, threshold: 0, cost_per_unit: 0 });
    },
  });

  const adjust = useMutation({
    mutationFn: () =>
      adjustInventory({
        inventory_item_id: adjustId!,
        quantity_change: parseFloat(adjustQty),
        reason: adjustReason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      setAdjustId(null);
      setAdjustQty("");
    },
  });

  const saveRecipe = useMutation({
    mutationFn: () =>
      updateRecipe(
        Number(recipeMenuId),
        recipeLines
          .filter((l) => l.inventory_item_id && l.quantity_required)
          .map((l) => ({
            inventory_item_id: l.inventory_item_id,
            quantity_required: parseFloat(l.quantity_required),
          }))
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-recipes"] }),
  });

  const loadRecipe = (menuItemId: number) => {
    setRecipeMenuId(menuItemId);
    const existing = recipes.find((r) => r.menu_item_id === menuItemId);
    setRecipeLines(
      existing?.lines.map((l) => ({
        inventory_item_id: l.inventory_item_id,
        quantity_required: String(l.quantity_required),
      })) ?? [{ inventory_item_id: 0, quantity_required: "" }]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["ingredients", "recipes"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded text-sm capitalize ${
              tab === t ? "bg-[var(--color-accent)] text-black font-medium" : "bg-white/10"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "ingredients" && (
        <>
          <form
            className="paper-card p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              createItem.mutate();
            }}
          >
            <p className="sm:col-span-2 lg:col-span-3 font-semibold text-sm">Add ingredient</p>
            <input
              required
              placeholder="Name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
            />
            <select
              value={newItem.unit}
              onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
              className="rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step="any"
              placeholder="Stock"
              value={newItem.current_stock || ""}
              onChange={(e) => setNewItem({ ...newItem, current_stock: parseFloat(e.target.value) || 0 })}
              className="rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
            />
            <input
              type="number"
              min={0}
              step="any"
              placeholder="Threshold"
              value={newItem.threshold || ""}
              onChange={(e) => setNewItem({ ...newItem, threshold: parseFloat(e.target.value) || 0 })}
              className="rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
            />
            <input
              type="number"
              min={0}
              placeholder="Cost/unit (paise)"
              value={newItem.cost_per_unit || ""}
              onChange={(e) => setNewItem({ ...newItem, cost_per_unit: parseInt(e.target.value, 10) || 0 })}
              className="rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
            />
            <button
              type="submit"
              disabled={createItem.isPending}
              className="rounded bg-[var(--color-ink)] text-white py-2 text-sm disabled:opacity-50"
            >
              Add
            </button>
          </form>

          {isLoading && <p className="text-white/70">Loading…</p>}
          <div className="space-y-2">
            {items.map((item: InventoryItem) => (
              <div key={item.id} className="paper-card p-4 flex flex-wrap justify-between gap-3 items-center">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm opacity-70">
                    {item.current_stock} {item.unit} · threshold {item.threshold} · ₹
                    {(item.cost_per_unit / 100).toFixed(2)}/{item.unit}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold ${alertClass(item.alert_level)}`}>
                    {item.alert_level}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAdjustId(item.id)}
                    className="text-sm rounded border border-black/20 px-3 py-1"
                  >
                    Adjust
                  </button>
                </div>
              </div>
            ))}
          </div>

          {adjustId != null && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
              <form
                className="paper-card p-5 w-full max-w-sm space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  adjust.mutate();
                }}
              >
                <p className="font-semibold">Adjust stock</p>
                <input
                  required
                  type="number"
                  step="any"
                  placeholder="+10 or -2"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
                />
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {adjust.error && <p className="text-sm text-red-700">{adjust.error.message}</p>}
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 rounded bg-green-700 text-white py-2 text-sm">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustId(null)}
                    className="px-4 rounded border border-black/20 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {tab === "recipes" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Menu items</p>
            {menuItems.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => loadRecipe(m.id)}
                className={`w-full text-left paper-card p-3 text-sm ${
                  recipeMenuId === m.id ? "ring-2 ring-[var(--color-accent)]" : ""
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>

          <div className="paper-card p-4 space-y-3">
            <p className="font-semibold text-sm">Recipe lines</p>
            {recipeMenuId === "" ? (
              <p className="text-sm opacity-60">Select a menu item</p>
            ) : (
              <>
                {recipeLines.map((line, idx) => (
                  <div key={idx} className="flex gap-2">
                    <select
                      value={line.inventory_item_id || ""}
                      onChange={(e) => {
                        const next = [...recipeLines];
                        next[idx] = { ...next[idx], inventory_item_id: parseInt(e.target.value, 10) };
                        setRecipeLines(next);
                      }}
                      className="flex-1 rounded border border-black/20 bg-white/50 px-2 py-1.5 text-sm text-[var(--color-ink)]"
                    >
                      <option value="">Ingredient</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      placeholder="Qty"
                      value={line.quantity_required}
                      onChange={(e) => {
                        const next = [...recipeLines];
                        next[idx] = { ...next[idx], quantity_required: e.target.value };
                        setRecipeLines(next);
                      }}
                      className="w-24 rounded border border-black/20 bg-white/50 px-2 py-1.5 text-sm text-[var(--color-ink)]"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setRecipeLines([...recipeLines, { inventory_item_id: 0, quantity_required: "" }])
                  }
                  className="text-sm text-[var(--color-accent)]"
                >
                  + Add line
                </button>
                <button
                  type="button"
                  disabled={saveRecipe.isPending}
                  onClick={() => saveRecipe.mutate()}
                  className="w-full rounded bg-[var(--color-ink)] text-white py-2 text-sm disabled:opacity-50"
                >
                  Save recipe
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
