"use client";

import { useState } from "react";
import type { MenuItem } from "@/lib/api";
import { useCart } from "@/stores/cart";

type Props = {
  item: MenuItem;
  onClose: () => void;
};

export function ItemModal({ item, onClose }: Props) {
  const addItem = useCart((s) => s.addItem);
  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const extraCost = item.customizations
    .filter((c) => selected.includes(c.name))
    .reduce((sum, c) => sum + c.price, 0);
  const unitPrice = item.price + extraCost;

  const toggleCustomization = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleAdd = () => {
    addItem({
      externalId: item.external_id,
      name: item.name,
      price: unitPrice,
      quantity: qty,
      customizations: selected,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div className="paper-card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-[family-name:var(--font-bebas)] text-2xl">{item.name}</h3>
            <p className="text-sm opacity-70 mt-1">{item.description}</p>
          </div>
          <button type="button" onClick={onClose} className="text-xl opacity-60 hover:opacity-100">
            ×
          </button>
        </div>

        <p className="mt-3 text-lg font-semibold">₹{unitPrice}</p>

        {item.customizations.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase opacity-60">Customizations</p>
            {item.customizations.map((c) => (
              <label key={c.name} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(c.name)}
                  onChange={() => toggleCustomization(c.name)}
                />
                <span>
                  {c.name}
                  {c.price > 0 && ` (+₹${c.price})`}
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-8 h-8 rounded bg-black/10"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              −
            </button>
            <span className="w-6 text-center font-medium">{qty}</span>
            <button
              type="button"
              className="w-8 h-8 rounded bg-black/10"
              onClick={() => setQty((q) => q + 1)}
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 rounded bg-[var(--color-ink)] text-white py-2 text-sm font-medium"
          >
            Add to order
          </button>
        </div>
      </div>
    </div>
  );
}
