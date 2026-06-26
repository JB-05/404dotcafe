"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { StaffGate } from "@/components/StaffGate";
import { useOrderSocket } from "@/hooks/useOrderSocket";
import {
  advanceKitchenOrder,
  fetchKitchenOrders,
  type OrderResponse,
} from "@/lib/api";
import { clearSession, getSession } from "@/lib/auth";

const COLUMNS = [
  { status: "PAID", label: "Paid", next: "IN_PREPARATION", action: "Start prep" },
  { status: "IN_PREPARATION", label: "Preparing", next: "READY", action: "Mark ready" },
  { status: "READY", label: "Ready", next: "COMPLETED", action: "Complete" },
] as const;

function elapsedMinutes(createdAt: string) {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

function KitchenCard({
  order,
  actionLabel,
  onAdvance,
  busy,
}: {
  order: OrderResponse;
  actionLabel: string;
  onAdvance: (order: OrderResponse) => void;
  busy: boolean;
}) {
  const minutes = elapsedMinutes(order.created_at);

  return (
    <div className="paper-card p-4 border-2 border-black/10">
      <div className="flex justify-between items-start gap-2">
        <p className="font-[family-name:var(--font-bebas)] text-2xl">{order.order_number}</p>
        <p className="text-xs opacity-60">{minutes}m</p>
      </div>
      {order.table_number && (
        <p className="text-xs font-medium opacity-70">Table {order.table_number}</p>
      )}
      <ul className="mt-2 text-sm space-y-1">
        {order.items.map((item, i) => (
          <li key={i}>
            <span className="font-semibold">{item.quantity}×</span> {item.name}
            {item.customizations.length > 0 && (
              <span className="block text-xs opacity-60">+ {item.customizations.join(", ")}</span>
            )}
            {item.notes && <span className="block text-xs text-amber-800">Note: {item.notes}</span>}
          </li>
        ))}
      </ul>
      {order.notes && (
        <p className="mt-2 text-xs text-amber-800 border-t border-black/10 pt-2">{order.notes}</p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => onAdvance(order)}
        className="mt-3 w-full rounded bg-[var(--color-ink)] text-white py-2 text-sm font-medium disabled:opacity-50"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function KitchenDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = getSession();

  useOrderSocket({ queryKeys: [["kitchen-orders"]] });

  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ["kitchen-orders"],
    queryFn: fetchKitchenOrders,
    refetchInterval: 5000,
  });

  const advance = useMutation({
    mutationFn: async ({ order, nextStatus }: { order: OrderResponse; nextStatus: string }) =>
      advanceKitchenOrder(order.id, nextStatus, order.version ?? 1),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] }),
  });

  const handleAdvance = (order: OrderResponse, nextStatus: string) => {
    advance.mutate({ order, nextStatus });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-bebas)] text-3xl">KITCHEN</h1>
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

      <main className="mx-auto max-w-6xl px-4 py-6">
        {advance.error && <p className="mb-4 text-sm text-red-400">{advance.error.message}</p>}
        {isLoading && <p className="text-white/70">Loading tickets…</p>}
        {error && <p className="text-red-400">Failed to load kitchen queue.</p>}

        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const columnOrders = orders.filter((o) => o.order_status === col.status);
            return (
              <section key={col.status} className="min-h-[200px]">
                <h2 className="font-[family-name:var(--font-bebas)] text-xl text-[var(--color-accent)] mb-3">
                  {col.label.toUpperCase()} ({columnOrders.length})
                </h2>
                <div className="space-y-3">
                  {columnOrders.length === 0 ? (
                    <p className="text-sm text-white/40">No orders</p>
                  ) : (
                    columnOrders.map((order) => (
                      <KitchenCard
                        key={order.id}
                        order={order}
                        actionLabel={col.action}
                        onAdvance={(o) => handleAdvance(o, col.next)}
                        busy={advance.isPending}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <Link href="/menu" className="mt-8 inline-block text-sm text-white/50 hover:text-white/80">
          ← Customer menu
        </Link>
      </main>
    </div>
  );
}

export default function KitchenPage() {
  return (
    <StaffGate roles={["KITCHEN", "ADMIN"]}>
      <KitchenDashboard />
    </StaffGate>
  );
}
