"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMenu } from "@/lib/api";
import { ItemModal } from "@/components/ItemModal";
import type { MenuItem } from "@/lib/api";
import { useCart, useCartCount } from "@/stores/cart";

export default function MenuPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["menu"], queryFn: fetchMenu });
  const count = useCartCount();
  const addItem = useCart((s) => s.addItem);
  const [selected, setSelected] = useState<MenuItem | null>(null);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[var(--color-bg-dark)]/95 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-[family-name:var(--font-marker)] text-2xl text-[var(--color-accent)]">
            404 CAFÉ
          </p>
          <p className="text-xs text-white/60">Muthoor, Thiruvalla</p>
        </div>
        <Link
          href="/checkout"
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Order List ({count})
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {isLoading && <p className="text-white/70">Loading menu…</p>}
        {error && (
          <div className="paper-card p-4 text-sm">
            <p className="font-semibold">API not reachable</p>
            <p className="mt-1 opacity-80">Start Postgres + backend, then run migrations and seed.</p>
          </div>
        )}

        {data?.categories.map((category) => (
          <section key={category.id} className="paper-card p-5">
            <h2 className="font-[family-name:var(--font-bebas)] text-3xl tracking-wide">
              {category.name}
            </h2>
            <ul className="mt-4 space-y-3">
              {category.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 border-b border-black/10 pb-3 last:border-0"
                >
                  <button
                    type="button"
                    className="text-left flex-1"
                    onClick={() => setSelected(item)}
                  >
                    <p className="font-medium">
                      {item.name}
                      <span className="ml-2 text-xs opacity-60">{item.veg ? "VEG" : "NON-VEG"}</span>
                    </p>
                    {item.description && (
                      <p className="text-sm opacity-70 mt-0.5">{item.description}</p>
                    )}
                  </button>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">₹{item.price}</p>
                    {category.slug === "addons" ? (
                      <button
                        type="button"
                        disabled={!item.available}
                        onClick={() =>
                          addItem({
                            externalId: item.external_id,
                            name: item.name,
                            price: item.price,
                            quantity: 1,
                            customizations: [],
                          })
                        }
                        className="mt-1 text-xs rounded bg-[var(--color-ink)] text-white px-2 py-1 disabled:opacity-40"
                      >
                        +
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!item.available}
                        onClick={() => setSelected(item)}
                        className="mt-1 text-xs rounded bg-[var(--color-ink)] text-white px-2 py-1 disabled:opacity-40"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      {selected && <ItemModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
