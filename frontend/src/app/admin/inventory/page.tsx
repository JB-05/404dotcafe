"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  adjustInventory,
  createInventoryItem,
  fetchInventoryItems,
  fetchMenuCatalog,
  saveMenuCatalogItem,
  type InventoryItem,
  type MenuCatalogItem,
} from "@/lib/api";

const UNITS = ["pcs", "g", "kg", "ml", "l"];
const REASONS = ["RESTOCK", "SPOILAGE", "DAMAGE", "CORRECTION"];

function alertClass(level: string) {
  if (level === "OUT") return "text-red-700";
  if (level === "CRITICAL") return "text-amber-700";
  if (level === "LOW") return "text-amber-600";
  return "text-green-700";
}

type RecipeLineEdit = { inventory_item_id: number; quantity_required: string };
type CustomizationEdit = { name: string; price: string };

function emptyRecipeLine(): RecipeLineEdit {
  return { inventory_item_id: 0, quantity_required: "" };
}

function MenuItemEditor({
  item,
  ingredients,
  onSaved,
}: {
  item: MenuCatalogItem;
  ingredients: InventoryItem[];
  onSaved: () => void;
}) {
  const [price, setPrice] = useState(String(item.price));
  const [customizations, setCustomizations] = useState<CustomizationEdit[]>(
    item.customizations.map((c) => ({ name: c.name, price: String(c.price) }))
  );
  const [lines, setLines] = useState<RecipeLineEdit[]>(
    item.lines.length > 0
      ? item.lines.map((l) => ({
          inventory_item_id: l.inventory_item_id,
          quantity_required: String(l.quantity_required),
        }))
      : [emptyRecipeLine()]
  );

  const save = useMutation({
    mutationFn: () => {
      const priceNum = parseInt(price, 10);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        throw new Error("Enter a valid price");
      }
      return saveMenuCatalogItem(item.id, {
        price: priceNum,
        customizations: customizations
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name.trim(),
            price: parseInt(c.price, 10) || 0,
          })),
        lines: lines
          .filter((l) => l.inventory_item_id && l.quantity_required)
          .map((l) => ({
            inventory_item_id: l.inventory_item_id,
            quantity_required: parseFloat(l.quantity_required),
          })),
      });
    },
    onSuccess: () => onSaved(),
  });

  const isAddon = item.category_slug === "addons";

  return (
    <div className="admin-card space-y-5">
      <div>
        <p className="font-semibold">{item.name}</p>
        <p className="text-xs admin-muted">
          {item.category_name} · {item.external_id}
        </p>
      </div>

      <div>
        <label className="admin-card-title block mb-1">Base price (₹)</label>
        <input
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="admin-input w-full max-w-[160px]"
        />
      </div>

      {!isAddon && (
        <div>
          <p className="admin-card-title mb-2">Add-on options (extra price)</p>
          <p className="text-xs admin-muted mb-2">
            Optional extras customers pick on this item (e.g. extra cheese, double patty).
          </p>
          <div className="space-y-2">
            {customizations.map((c, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  placeholder="Add-on name"
                  value={c.name}
                  onChange={(e) => {
                    const next = [...customizations];
                    next[idx] = { ...next[idx], name: e.target.value };
                    setCustomizations(next);
                  }}
                  className="flex-1 admin-input py-1.5"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="₹"
                  value={c.price}
                  onChange={(e) => {
                    const next = [...customizations];
                    next[idx] = { ...next[idx], price: e.target.value };
                    setCustomizations(next);
                  }}
                  className="w-24 admin-input py-1.5"
                />
                <button
                  type="button"
                  onClick={() => setCustomizations(customizations.filter((_, i) => i !== idx))}
                  className="admin-btn text-xs text-red-600 border-red-200"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setCustomizations([...customizations, { name: "", price: "0" }])}
              className="text-sm text-blue-600"
            >
              + Add option
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="admin-card-title mb-2">Inventory recipe (per serving)</p>
        <p className="text-xs admin-muted mb-2">
          Ingredients deducted from stock when this item is sold. Set quantity per 1 unit ordered.
        </p>
        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={idx} className="flex gap-2">
              <select
                value={line.inventory_item_id || ""}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...next[idx], inventory_item_id: parseInt(e.target.value, 10) };
                  setLines(next);
                }}
                className="flex-1 admin-input py-1.5"
              >
                <option value="">Ingredient</option>
                {ingredients.map((i) => (
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
                  const next = [...lines];
                  next[idx] = { ...next[idx], quantity_required: e.target.value };
                  setLines(next);
                }}
                className="w-24 admin-input py-1.5"
              />
              <button
                type="button"
                onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                className="admin-btn text-xs"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines([...lines, emptyRecipeLine()])}
            className="text-sm text-blue-600"
          >
            + Add ingredient
          </button>
        </div>
      </div>

      {save.isError && <p className="text-sm text-red-600">{save.error.message}</p>}

      <button
        type="button"
        disabled={save.isPending}
        onClick={() => save.mutate()}
        className="w-full admin-btn admin-btn-primary disabled:opacity-50"
      >
        {save.isPending ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
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
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: fetchInventoryItems,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["menu-catalog"],
    queryFn: fetchMenuCatalog,
  });

  const groupedCatalog = useMemo(() => {
    const groups = new Map<string, MenuCatalogItem[]>();
    for (const entry of catalog) {
      const list = groups.get(entry.category_name) ?? [];
      list.push(entry);
      groups.set(entry.category_name, list);
    }
    return [...groups.entries()];
  }, [catalog]);

  const selectedItem = catalog.find((c) => c.id === selectedMenuId) ?? null;

  const invalidateMenu = () => {
    queryClient.invalidateQueries({ queryKey: ["menu-catalog"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-recipes"] });
  };

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

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["ingredients", "recipes"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`admin-tab capitalize ${tab === t ? "active" : ""}`}
          >
            {t === "recipes" ? "Menu & recipes" : t}
          </button>
        ))}
      </div>

      {tab === "ingredients" && (
        <>
          <form
            className="admin-card grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
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
              className="admin-input"
            />
            <select
              value={newItem.unit}
              onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
              className="admin-input"
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
              className="admin-input"
            />
            <input
              type="number"
              min={0}
              step="any"
              placeholder="Threshold"
              value={newItem.threshold || ""}
              onChange={(e) => setNewItem({ ...newItem, threshold: parseFloat(e.target.value) || 0 })}
              className="admin-input"
            />
            <input
              type="number"
              min={0}
              placeholder="Cost/unit (paise)"
              value={newItem.cost_per_unit || ""}
              onChange={(e) => setNewItem({ ...newItem, cost_per_unit: parseInt(e.target.value, 10) || 0 })}
              className="admin-input"
            />
            <button
              type="submit"
              disabled={createItem.isPending}
              className="admin-btn admin-btn-primary disabled:opacity-50"
            >
              Add
            </button>
          </form>

          {isLoading && <p className="admin-muted">Loading…</p>}
          <div className="space-y-2">
            {items.map((item: InventoryItem) => (
              <div key={item.id} className="admin-card flex flex-wrap justify-between gap-3 items-center">
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
                    className="admin-btn text-sm"
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
                className="admin-card w-full max-w-sm space-y-3"
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
                  className="w-full admin-input"
                />
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full admin-input"
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {adjust.error && <p className="text-sm text-red-700">{adjust.error.message}</p>}
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 admin-btn admin-btn-primary py-2">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustId(null)}
                    className="admin-btn px-4"
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
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <p className="text-sm font-semibold">All menu items</p>
            <p className="text-xs admin-muted">
              Edit price, add-on options, and inventory quantities for every item including standalone add-ons.
            </p>
            {groupedCatalog.map(([category, entries]) => (
              <div key={category}>
                <p className="text-xs font-medium admin-muted uppercase tracking-wide mb-2">{category}</p>
                <div className="space-y-1.5">
                  {entries.map((m) => {
                    const hasRecipe = m.lines.length > 0;
                    const hasAddons = m.customizations.length > 0;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMenuId(m.id)}
                        className={`w-full text-left admin-card text-sm ${
                          selectedMenuId === m.id ? "ring-2 ring-slate-400" : ""
                        }`}
                      >
                        <div className="flex justify-between gap-2 items-start">
                          <span className="font-medium">{m.name}</span>
                          <span className="text-xs admin-muted shrink-0">₹{m.price}</span>
                        </div>
                        <p className="text-xs admin-muted mt-0.5">
                          {hasRecipe ? `${m.lines.length} ingredient${m.lines.length === 1 ? "" : "s"}` : "No recipe"}
                          {hasAddons ? ` · ${m.customizations.length} add-on${m.customizations.length === 1 ? "" : "s"}` : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {catalog.length === 0 && <p className="text-sm admin-muted">No menu items found.</p>}
          </div>

          <div>
            {selectedItem ? (
              <MenuItemEditor
                key={selectedItem.id}
                item={selectedItem}
                ingredients={items}
                onSaved={invalidateMenu}
              />
            ) : (
              <div className="admin-card">
                <p className="text-sm admin-muted">Select a menu item to edit price, add-ons, and recipe.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
