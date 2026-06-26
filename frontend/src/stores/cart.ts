import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";

export type CartLine = {
  lineKey: string;
  externalId: string;
  name: string;
  price: number;
  quantity: number;
  customizations: string[];
  notes?: string;
};

type LegacyCartLine = {
  lineKey?: string;
  externalId?: string;
  id?: string;
  name?: string;
  price?: number;
  quantity?: number;
  customizations?: string[];
  notes?: string;
};

export function cartLineKey(externalId: string, customizations: string[] = []) {
  return `${externalId}::${[...customizations].sort().join("|")}`;
}

function normalizeCartLine(raw: LegacyCartLine): CartLine | null {
  const externalId = raw.externalId ?? raw.id;
  if (!externalId || !raw.name || raw.price == null) return null;

  const customizations = raw.customizations ?? [];
  const lineKey = raw.lineKey ?? cartLineKey(externalId, customizations);

  return {
    lineKey,
    externalId,
    name: raw.name,
    price: raw.price,
    quantity: raw.quantity ?? 1,
    customizations,
    notes: raw.notes,
  };
}

type CartState = {
  items: CartLine[];
  addItem: (item: Omit<CartLine, "lineKey"> & { lineKey?: string }) => void;
  updateQty: (lineKey: string, delta: number) => void;
  removeItem: (lineKey: string) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const lineKey = item.lineKey ?? cartLineKey(item.externalId, item.customizations ?? []);
          const existing = state.items.find((i) => i.lineKey === lineKey);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.lineKey === lineKey ? { ...i, quantity: i.quantity + item.quantity } : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { ...item, lineKey, customizations: item.customizations ?? [] },
            ],
          };
        }),
      updateQty: (lineKey, delta) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.lineKey === lineKey ? { ...i, quantity: i.quantity + delta } : i))
            .filter((i) => i.quantity > 0),
        })),
      removeItem: (lineKey) =>
        set((state) => ({ items: state.items.filter((i) => i.lineKey !== lineKey) })),
      clear: () => set({ items: [] }),
      total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      count: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "cafeos-cart",
      version: 2,
      migrate: (persisted) => {
        const state = persisted as { items?: LegacyCartLine[] } | undefined;
        const items = (state?.items ?? [])
          .map(normalizeCartLine)
          .filter((line): line is CartLine => line !== null);
        return { items };
      },
    }
  )
);

/** Avoid SSR/client mismatch — wait until localStorage cart is rehydrated. */
export function useCartHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(useCart.persist.hasHydrated());
    return useCart.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}

export function useCartCount() {
  const hydrated = useCartHydrated();
  const count = useCart((s) => s.count());
  return hydrated ? count : 0;
}
