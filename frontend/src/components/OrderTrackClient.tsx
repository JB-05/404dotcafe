"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchOrder } from "@/lib/api";
import { useOrderSocket } from "@/hooks/useOrderSocket";

const STEPS = [
  "PENDING_PAYMENT",
  "PAID",
  "IN_PREPARATION",
  "READY",
  "COMPLETED",
] as const;

const STEP_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Pending Payment",
  PAID: "Paid",
  IN_PREPARATION: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function OrderTrackClient({ orderId }: { orderId: string }) {
  const id = parseInt(orderId, 10);

  useOrderSocket({ orderId: Number.isNaN(id) ? undefined : id, enabled: !Number.isNaN(id) });

  const { data, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrder(id),
    enabled: !Number.isNaN(id),
    refetchInterval: 5000,
  });

  if (Number.isNaN(id)) {
    return <p className="text-white/70">Invalid order ID</p>;
  }

  if (isLoading) return <p className="text-white/70">Loading order…</p>;
  if (error || !data) {
    return (
      <div className="paper-card p-6 text-center">
        <p className="font-semibold">Order not found</p>
        <Link href="/menu" className="mt-4 inline-block text-sm text-[var(--color-accent)]">
          Back to menu
        </Link>
      </div>
    );
  }

  const currentIdx =
    data.order_status === "CANCELLED"
      ? -1
      : STEPS.indexOf(data.order_status as (typeof STEPS)[number]);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md space-y-4">
        <Link href="/menu" className="text-sm text-white/70 hover:text-white">
          ← Order more
        </Link>

        <div className="paper-card p-6 text-center">
          <p className="font-[family-name:var(--font-special)] text-sm opacity-70">ORDER TOKEN</p>
          <p className="text-3xl font-bold mt-1">{data.order_number}</p>
          <p className="mt-2 text-sm">{STEP_LABELS[data.order_status] ?? data.order_status}</p>
        </div>

        {data.order_status === "PENDING_PAYMENT" && (
          <div className="paper-card p-6 text-center border-2 border-[var(--color-accent)]">
            <p className="font-[family-name:var(--font-bebas)] text-xl">PAY VIA UPI</p>
            <p className="text-4xl font-bold mt-2">₹{data.total}</p>
            <p className="mt-3 text-sm opacity-70">
              Show this token to staff after payment. They will confirm your order.
            </p>
            <p className="mt-2 font-[family-name:var(--font-special)] text-lg">{data.order_number}</p>
          </div>
        )}

        <div className="paper-card p-5">
          <p className="text-xs font-semibold uppercase opacity-60 mb-3">Progress</p>
          <ul className="space-y-2">
            {STEPS.map((step, idx) => {
              const done = currentIdx >= idx;
              const active = data.order_status === step;
              return (
                <li
                  key={step}
                  className={`flex items-center gap-2 text-sm ${
                    done ? "opacity-100" : "opacity-40"
                  } ${active ? "font-semibold" : ""}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      done ? "bg-[var(--color-accent)]" : "bg-black/20"
                    }`}
                  />
                  {STEP_LABELS[step]}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="paper-card p-5 space-y-2 text-sm">
          <p className="font-semibold">Items</p>
          {data.items.map((item, i) => (
            <div key={i} className="flex justify-between">
              <span>
                {item.quantity}× {item.name}
                {item.customizations.length > 0 && (
                  <span className="block text-xs opacity-60">
                    + {item.customizations.join(", ")}
                  </span>
                )}
              </span>
              <span>₹{item.subtotal}</span>
            </div>
          ))}
          <hr className="border-black/10" />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>₹{data.total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
