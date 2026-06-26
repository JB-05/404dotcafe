"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CakeSlice,
  Clock,
  Coffee,
  Leaf,
  MapPin,
  Plus,
  Sandwich,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { fetchMenu, fetchCafeStatus } from "@/lib/api";
import { ItemModal } from "@/components/ItemModal";
import type { MenuItem } from "@/lib/api";
import { useCart, useCartCount } from "@/stores/cart";
import "./menu.css";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  burgers: Sandwich,
  drinks: Coffee,
  desserts: CakeSlice,
  addons: Sparkles,
};

function CategoryIcon({ slug }: { slug: string }) {
  const Icon = CATEGORY_ICONS[slug] ?? UtensilsCrossed;
  return <Icon size={18} strokeWidth={2} aria-hidden />;
}

function bentoClass(index: number, hasLongDesc: boolean) {
  const classes = ["menu-item-card"];
  if (index % 7 === 0) classes.push("menu-item-wide");
  if (hasLongDesc && index % 5 === 2) classes.push("menu-item-tall");
  return classes.join(" ");
}

type MenuItemCardProps = {
  item: MenuItem;
  index: number;
  onSelect: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
};

function MenuItemCard({ item, index, onSelect, onAdd }: MenuItemCardProps) {
  const hasLongDesc = Boolean(item.description && item.description.length > 60);
  const hasCustomizations = item.customizations.length > 0;

  const handleAddToCart = () => {
    if (hasCustomizations) {
      onSelect(item);
    } else {
      onAdd(item);
    }
  };

  return (
    <li
      className={`${bentoClass(index, hasLongDesc)} ${!item.available ? "menu-item-unavailable" : ""}`}
    >
      <button
        type="button"
        className="menu-item-body"
        onClick={() => item.available && onSelect(item)}
        disabled={!item.available}
      >
        <div className="menu-item-top">
          <span className={`menu-badge ${item.veg ? "menu-badge-veg" : "menu-badge-nonveg"}`}>
            {item.veg ? (
              <>
                <Leaf size={10} strokeWidth={2.5} aria-hidden />
                VEG
              </>
            ) : (
              "NON-VEG"
            )}
          </span>
          {!item.available && <span className="menu-sold-out">Sold out</span>}
        </div>

        <h3 className="menu-item-name">{item.name}</h3>

        {item.description && <p className="menu-item-desc">{item.description}</p>}
      </button>

      <div className="menu-item-foot">
        <p className="menu-item-price">₹{item.price}</p>
        {item.available && (
          <button type="button" onClick={handleAddToCart} className="menu-item-btn">
            <Plus size={12} strokeWidth={2.5} aria-hidden />
            Add to cart
          </button>
        )}
      </div>
    </li>
  );
}

export default function MenuPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["menu"], queryFn: fetchMenu });
  const { data: cafeStatus } = useQuery({
    queryKey: ["cafe-status"],
    queryFn: fetchCafeStatus,
    refetchInterval: 30000,
  });
  const cafeClosed = cafeStatus && !cafeStatus.is_open;
  const count = useCartCount();
  const addItem = useCart((s) => s.addItem);
  const [selected, setSelected] = useState<MenuItem | null>(null);

  const addToCart = (item: MenuItem) => {
    addItem({
      externalId: item.external_id,
      name: item.name,
      price: item.price,
      quantity: 1,
      customizations: [],
    });
  };

  return (
    <div className="menu-shell">
      <header className="menu-header">
        <div className="menu-header-inner flex items-center justify-between gap-3">
          <div>
            <p className="menu-logo">404 CAFÉ</p>
            <p className="menu-tagline">
              <MapPin size={11} strokeWidth={2} className="menu-tagline-icon" aria-hidden />
              Muthoor · Thiruvalla
            </p>
          </div>
          <Link
            href={cafeClosed ? "#" : "/checkout"}
            aria-disabled={cafeClosed}
            className="menu-cart-btn"
            onClick={(e) => cafeClosed && e.preventDefault()}
          >
            <ShoppingBag size={15} strokeWidth={2} aria-hidden />
            Order list ({count})
          </Link>
        </div>
      </header>

      <main className="menu-main">
        <div className="menu-hero">
          <p className="menu-hero-title">What&apos;s cooking?</p>
          <p className="menu-hero-sub">
            Add items to your cart, build your order, then pay at the counter when you&apos;re
            ready.
          </p>
        </div>

        {cafeClosed && (
          <div className="menu-alert">
            <Clock size={18} strokeWidth={2} className="menu-alert-icon" aria-hidden />
            <div>
              <p className="font-semibold">We&apos;re closed right now</p>
              <p className="mt-1 opacity-90">
                Browse the menu — checkout opens when the café is open.
              </p>
            </div>
          </div>
        )}

        {isLoading && <p className="menu-loading">Fetching today&apos;s menu…</p>}

        {error && (
          <div className="menu-category">
            <p className="font-semibold">Menu unavailable</p>
            <p className="mt-1 text-sm opacity-75">
              Could not reach the server. Make sure the backend is running.
            </p>
          </div>
        )}

        {data?.categories.map((category) => (
          <section key={category.id} className="menu-category">
            <div className="menu-category-head">
              <span className="menu-category-icon" aria-hidden>
                <CategoryIcon slug={category.slug} />
              </span>
              <h2 className="menu-category-title">{category.name}</h2>
              <span className="menu-category-count">{category.items.length} items</span>
            </div>

            <ul className="menu-bento">
              {category.items.map((item, index) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  onSelect={setSelected}
                  onAdd={addToCart}
                />
              ))}
            </ul>
          </section>
        ))}
      </main>

      <footer className="menu-footer">
        <p className="menu-footer-text">
          Developed and maintained by{" "}
          <a
            href="https://ugenix.in"
            target="_blank"
            rel="noopener noreferrer"
            className="menu-footer-link"
          >
            Ugenix Technologies LLP
          </a>
        </p>
      </footer>

      {selected && <ItemModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
