"use client";

import Link from "next/link";
import { useCart } from "@/stores/cart";

export default function CheckoutPage() {
  const items = useCart((s) => s.items);
  const total = useCart((s) => s.total());
  const cgst = Math.round(total * 0.025);
  const sgst = Math.round(total * 0.025);
  const grand = total + cgst + sgst;

  return (
    <div className="min-h-screen mx-auto max-w-lg px-4 py-8">
      <Link href="/menu" className="text-sm text-white/70 hover:text-white">
        ← Back to menu
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-bebas)] text-4xl">CHECKOUT</h1>

      <div className="paper-card mt-6 p-5 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm opacity-70">Your order pad is empty.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                {item.quantity}× {item.name}
              </span>
              <span>₹{item.price * item.quantity}</span>
            </div>
          ))
        )}
        <hr className="border-black/10" />
        <div className="flex justify-between text-sm">
          <span>CGST (2.5%)</span>
          <span>₹{cgst}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>SGST (2.5%)</span>
          <span>₹{sgst}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>₹{grand}</span>
        </div>
      </div>

      <p className="mt-4 text-sm text-white/60">
        Order submission API coming in Step 5. Cart is saved locally.
      </p>
    </div>
  );
}
