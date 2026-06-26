"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createOrder, fetchCafeStatus } from "@/lib/api";
import { useCart } from "@/stores/cart";

export default function CheckoutPage() {
  const router = useRouter();
  const { data: cafeStatus } = useQuery({
    queryKey: ["cafe-status"],
    queryFn: fetchCafeStatus,
    refetchInterval: 30000,
  });
  const cafeClosed = cafeStatus && !cafeStatus.is_open;
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const updateQty = useCart((s) => s.updateQty);
  const removeItem = useCart((s) => s.removeItem);
  const total = useCart((s) => s.total());
  const cgst = Math.round(total * 0.025);
  const sgst = Math.round(total * 0.025);
  const grand = total + cgst + sgst;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [table, setTable] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || items.length === 0 || cafeClosed) return;

    setSubmitting(true);
    setError("");
    try {
      const idempotencyKey = crypto.randomUUID();
      const order = await createOrder(
        {
          customer_name: name.trim(),
          customer_phone: phone.trim() || undefined,
          customer_email: email.trim() || undefined,
          table_number: table.trim() || undefined,
          notes: notes.trim() || undefined,
          items: items.map((item) => ({
            external_id: item.externalId,
            quantity: item.quantity,
            customizations: item.customizations ?? [],
            notes: item.notes,
          })),
        },
        idempotencyKey
      );
      clear();
      router.push(`/order/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen mx-auto max-w-lg px-4 py-8">
      <Link href="/menu" className="text-sm text-white/70 hover:text-white">
        ← Back to menu
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-bebas)] text-4xl">CHECKOUT</h1>

      {cafeClosed && (
        <div className="mt-4 paper-card p-4 border border-amber-600/50">
          <p className="font-semibold text-sm">Cafe is closed</p>
          <p className="text-sm opacity-80 mt-1">We are not accepting orders right now. Please check back later.</p>
        </div>
      )}

      <div className="paper-card mt-6 p-5 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm opacity-70">Your order pad is empty.</p>
        ) : (
          items.map((item) => (
            <div key={item.lineKey ?? item.externalId} className="text-sm">
              <div className="flex justify-between gap-2">
                <span>
                  {item.name}
                  {item.customizations?.length > 0 && (
                    <span className="block text-xs opacity-60">
                      + {item.customizations.join(", ")}
                    </span>
                  )}
                </span>
                <span>₹{item.price * item.quantity}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  className="text-xs px-2 py-0.5 bg-black/10 rounded"
                  onClick={() => updateQty(item.lineKey ?? item.externalId, -1)}
                >
                  −
                </button>
                <span>{item.quantity}</span>
                <button
                  type="button"
                  className="text-xs px-2 py-0.5 bg-black/10 rounded"
                  onClick={() => updateQty(item.lineKey ?? item.externalId, 1)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="text-xs text-red-700 ml-auto"
                  onClick={() => removeItem(item.lineKey ?? item.externalId)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
        <hr className="border-black/10" />
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>₹{total}</span>
        </div>
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

      <form onSubmit={handleSubmit} className="paper-card mt-4 p-5 space-y-3">
        <div>
          <label className="text-xs opacity-70">Name *</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="text-xs opacity-70">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="text-xs opacity-70">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
            placeholder="For invoice (optional)"
          />
        </div>
        <div>
          <label className="text-xs opacity-70">Table no.</label>
          <input
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className="mt-1 w-full rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
            placeholder="e.g. 04"
          />
        </div>
        <div>
          <label className="text-xs opacity-70">Order notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
            placeholder="Optional"
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting || items.length === 0 || !name.trim() || cafeClosed}
          className="w-full rounded bg-[var(--color-accent)] text-white py-3 font-medium disabled:opacity-50"
        >
          {submitting ? "Placing order…" : "Place order"}
        </button>
      </form>
    </div>
  );
}
