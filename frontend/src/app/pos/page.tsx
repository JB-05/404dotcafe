"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { StaffGate } from "@/components/StaffGate";
import { useOrderSocket } from "@/hooks/useOrderSocket";
import { cancelPosOrder, fetchPosOrders, markOrderPaid, type OrderResponse } from "@/lib/api";
import { clearSession, getSession } from "@/lib/auth";

function elapsedMinutes(createdAt: string) {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

function urgencyClass(minutes: number) {
  if (minutes >= 10) return "border-red-600 bg-red-50";
  if (minutes >= 5) return "border-amber-500 bg-amber-50";
  return "border-black/10";
}

function OrderCard({
  order,
  onPaid,
  onCancel,
  busy,
}: {
  order: OrderResponse;
  onPaid: (order: OrderResponse) => void;
  onCancel: (order: OrderResponse) => void;
  busy: boolean;
}) {
  const minutes = elapsedMinutes(order.created_at);
  const unpaid = order.order_status === "PENDING_PAYMENT";

  return (
    <div className={`paper-card p-4 border-2 ${urgencyClass(minutes)}`}>
      <div className="flex justify-between items-start gap-3">
        <div>
          <p className="font-[family-name:var(--font-bebas)] text-2xl">{order.order_number}</p>
          <p className="text-sm font-medium">{order.customer_name}</p>
          {order.table_number && (
            <p className="text-xs opacity-70">Table {order.table_number}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">₹{order.total}</p>
          <p className="text-xs opacity-70">{minutes} min ago</p>
        </div>
      </div>

      <ul className="mt-3 text-sm space-y-1 opacity-80">
        {order.items.map((item, i) => (
          <li key={i}>
            {item.quantity}× {item.name}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs font-semibold uppercase tracking-wide opacity-60">
        {order.order_status.replace("_", " ")}
      </p>

      {unpaid && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onPaid(order)}
            className="flex-1 rounded bg-green-700 text-white py-2 text-sm font-medium disabled:opacity-50"
          >
            Mark paid
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onCancel(order)}
            className="rounded border border-red-700 text-red-800 px-4 py-2 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function PosDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = getSession();

  useOrderSocket({ queryKeys: [["pos-orders"]] });

  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ["pos-orders"],
    queryFn: fetchPosOrders,
    refetchInterval: 5000,
  });

  const action = useMutation({
    mutationFn: async ({
      type,
      order,
    }: {
      type: "paid" | "cancel";
      order: OrderResponse;
    }) => {
      const version = order.version ?? 1;
      if (type === "paid") return markOrderPaid(order.id, version);
      return cancelPosOrder(order.id, version);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pos-orders"] }),
  });

  const handlePaid = (order: OrderResponse) => {
    if (!confirm(`Confirm payment of ₹${order.total} for ${order.order_number}?`)) return;
    action.mutate({ type: "paid", order });
  };

  const handleCancel = (order: OrderResponse) => {
    if (!confirm(`Cancel order ${order.order_number}?`)) return;
    action.mutate({ type: "cancel", order });
  };

  const unpaid = orders.filter((o) => o.order_status === "PENDING_PAYMENT");
  const other = orders.filter((o) => o.order_status !== "PENDING_PAYMENT");

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-bebas)] text-3xl">POS</h1>
          <p className="text-sm text-white/60">Signed in as {session?.name}</p>
        </div>
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={() => refetch()} className="text-white/70 hover:text-white">
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              clearSession();
              router.push("/login");
            }}
            className="text-white/70 hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-8">
        {action.error && (
          <p className="text-sm text-red-400">{action.error.message}</p>
        )}
        {isLoading && <p className="text-white/70">Loading orders…</p>}
        {error && <p className="text-red-400">Failed to load orders. Check login.</p>}

        <section>
          <h2 className="font-[family-name:var(--font-bebas)] text-xl text-[var(--color-accent)] mb-3">
            AWAITING PAYMENT ({unpaid.length})
          </h2>
          {unpaid.length === 0 ? (
            <p className="text-white/50 text-sm">No unpaid orders.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {unpaid.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onPaid={handlePaid}
                  onCancel={handleCancel}
                  busy={action.isPending}
                />
              ))}
            </div>
          )}
        </section>

        {other.length > 0 && (
          <section>
            <h2 className="font-[family-name:var(--font-bebas)] text-xl mb-3">IN PROGRESS ({other.length})</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {other.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onPaid={handlePaid}
                  onCancel={handleCancel}
                  busy={action.isPending}
                />
              ))}
            </div>
          </section>
        )}

        <Link href="/menu" className="text-sm text-white/50 hover:text-white/80">
          ← Customer menu
        </Link>
      </main>
    </div>
  );
}

export default function PosPage() {
  return (
    <StaffGate roles={["STAFF", "ADMIN"]}>
      <PosDashboard />
    </StaffGate>
  );
}
