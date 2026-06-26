"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PosOrderForm } from "@/components/PosOrderForm";
import { StaffGate } from "@/components/StaffGate";
import { useOrderSocket } from "@/hooks/useOrderSocket";
import {
  addPosOrderItems,
  cancelPosOrder,
  completePosOrder,
  createPosOrder,
  fetchCafeStatus,
  fetchPosOrders,
  markOrderPaid,
  updatePosOrder,
  type CreateOrderPayload,
  type OrderResponse,
} from "@/lib/api";
import { clearSession, getSession } from "@/lib/auth";

const PAID_STATUSES = ["PAID", "IN_PREPARATION", "READY"] as const;

function elapsedMinutes(createdAt: string) {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

function statusClass(status: string) {
  if (status === "PENDING_PAYMENT") return "pos-status-pending";
  if (status === "COMPLETED") return "pos-status-completed";
  if (PAID_STATUSES.includes(status as (typeof PAID_STATUSES)[number])) return "pos-status-paid";
  return "";
}

function statusLabel(status: string) {
  if (status === "PENDING_PAYMENT") return "Awaiting payment";
  if (status === "COMPLETED") return "Completed";
  if (status === "PAID") return "Paid";
  return status.replace(/_/g, " ");
}

function OrderGrid({
  orders,
  emptyMessage,
  onPaid,
  onCancel,
  onEdit,
  onAddItems,
  onComplete,
  busy,
}: {
  orders: OrderResponse[];
  emptyMessage?: string;
  onPaid: (order: OrderResponse) => void;
  onCancel: (order: OrderResponse) => void;
  onEdit: (order: OrderResponse) => void;
  onAddItems: (order: OrderResponse) => void;
  onComplete: (order: OrderResponse) => void;
  busy: boolean;
}) {
  if (orders.length === 0) {
    return emptyMessage ? <p className="text-sm pos-muted py-2">{emptyMessage}</p> : null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          onPaid={onPaid}
          onCancel={onCancel}
          onEdit={onEdit}
          onAddItems={onAddItems}
          onComplete={onComplete}
          busy={busy}
        />
      ))}
    </div>
  );
}

function OrderCard({
  order,
  onPaid,
  onCancel,
  onEdit,
  onAddItems,
  onComplete,
  busy,
}: {
  order: OrderResponse;
  onPaid: (order: OrderResponse) => void;
  onCancel: (order: OrderResponse) => void;
  onEdit: (order: OrderResponse) => void;
  onAddItems: (order: OrderResponse) => void;
  onComplete: (order: OrderResponse) => void;
  busy: boolean;
}) {
  const minutes = elapsedMinutes(order.created_at);
  const unpaid = order.order_status === "PENDING_PAYMENT";
  const completed = order.order_status === "COMPLETED";
  const balanceDue = order.balance_due ?? (unpaid ? order.total : 0);
  const canAddItems = PAID_STATUSES.includes(order.order_status as (typeof PAID_STATUSES)[number]);
  const hasExtraDue = balanceDue > 0 && !unpaid;
  const canComplete = canAddItems && !hasExtraDue;
  const urgent = !completed && minutes >= 10;
  const warn = !completed && minutes >= 5 && minutes < 10;

  return (
    <div
      className={`pos-card ${completed ? "pos-card-completed" : urgent ? "pos-card-urgent" : warn ? "pos-card-warn" : ""}`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-lg leading-tight">{order.order_number}</p>
          <p className="text-sm font-medium truncate">{order.customer_name}</p>
          {order.table_number && (
            <p className="text-xs pos-muted">Table {order.table_number}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold">₹{order.total}</p>
          {hasExtraDue && (
            <p className="text-sm font-semibold text-amber-700">+₹{balanceDue} due</p>
          )}
          <p className="text-xs pos-muted">{minutes}m</p>
        </div>
      </div>

      <ul className="mt-2 text-sm pos-muted space-y-0.5">
        {order.items.slice(0, 4).map((item, i) => (
          <li key={i} className="truncate">
            {item.quantity}× {item.name}
          </li>
        ))}
        {order.items.length > 4 && (
          <li className="text-xs">+{order.items.length - 4} more</li>
        )}
      </ul>

      <div className="mt-2">
        <span className={`pos-status ${statusClass(order.order_status)}`}>
          {statusLabel(order.order_status)}
        </span>
        {order.upi_txn_last5 && (
          <p className="text-xs pos-muted mt-1">UPI ···{order.upi_txn_last5}</p>
        )}
      </div>

      {!completed && (
        <div className="mt-3 flex flex-wrap gap-2">
          {unpaid && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPaid(order)}
                className="pos-btn pos-btn-success pos-btn-lg flex-1 min-w-[120px]"
              >
                Paid ₹{balanceDue}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onEdit(order)}
                className="pos-btn"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onCancel(order)}
                className="pos-btn pos-btn-danger"
              >
                Cancel
              </button>
            </>
          )}
          {canAddItems && (
            <>
              {hasExtraDue && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPaid(order)}
                  className="pos-btn pos-btn-success pos-btn-lg flex-1"
                >
                  Collect ₹{balanceDue}
                </button>
              )}
              {canComplete && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onComplete(order)}
                  className="pos-btn pos-btn-primary pos-btn-lg flex-1"
                >
                  Complete
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => onAddItems(order)}
                className="pos-btn"
              >
                + Items
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type FormMode = "create" | "edit" | "add" | null;

function PaymentConfirmModal({
  order,
  busy,
  onClose,
  onConfirm,
}: {
  order: OrderResponse;
  busy: boolean;
  onClose: () => void;
  onConfirm: (upiTxnLast5?: string) => void;
}) {
  const [upiRef, setUpiRef] = useState("");
  const balanceDue = order.balance_due ?? (order.order_status === "PENDING_PAYMENT" ? order.total : 0);

  return (
    <div className="pos-overlay">
      <div className="pos-modal">
        <p className="font-semibold text-lg">Confirm payment</p>
        <p className="text-sm pos-muted mt-1">
          {order.order_number} · {order.customer_name}
        </p>
        <p className="text-2xl font-bold mt-3">₹{balanceDue}</p>

        <label className="block mt-4 text-sm font-medium">
          UPI transaction ID <span className="font-normal pos-muted">(optional)</span>
        </label>
        <p className="text-xs pos-muted mb-2">Last 5 digits from the customer&apos;s UPI payment</p>
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          placeholder="e.g. 48291"
          value={upiRef}
          onChange={(e) => setUpiRef(e.target.value.replace(/\D/g, "").slice(0, 5))}
          className="pos-input w-full text-center text-lg tracking-widest"
          autoFocus
        />

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(upiRef.length === 5 ? upiRef : undefined)}
            className="pos-btn pos-btn-success pos-btn-lg w-full"
          >
            {busy ? "Processing…" : "Confirm paid"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(undefined)}
            className="pos-btn w-full"
          >
            Skip · confirm without UPI ref
          </button>
          <button type="button" disabled={busy} onClick={onClose} className="pos-btn w-full">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function PosDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = getSession();
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [activeOrder, setActiveOrder] = useState<OrderResponse | null>(null);
  const [payOrder, setPayOrder] = useState<OrderResponse | null>(null);

  useOrderSocket({ queryKeys: [["pos-orders"]] });

  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ["pos-orders"],
    queryFn: fetchPosOrders,
    refetchInterval: 5000,
  });

  const { data: cafeStatus } = useQuery({
    queryKey: ["cafe-status"],
    queryFn: fetchCafeStatus,
    refetchInterval: 30000,
  });
  const cafeClosed = cafeStatus && !cafeStatus.is_open;

  const action = useMutation({
    mutationFn: async ({
      type,
      order,
      upiTxnLast5,
    }: {
      type: "paid" | "cancel" | "complete";
      order: OrderResponse;
      upiTxnLast5?: string;
    }) => {
      const version = order.version ?? 1;
      if (type === "paid") return markOrderPaid(order.id, version, upiTxnLast5);
      if (type === "complete") return completePosOrder(order.id, version);
      return cancelPosOrder(order.id, version);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-orders"] });
      setPayOrder(null);
    },
  });

  const saveOrder = useMutation({
    mutationFn: async ({
      mode,
      payload,
      order,
      version,
    }: {
      mode: "create" | "edit" | "add";
      payload: CreateOrderPayload;
      order?: OrderResponse;
      version?: number;
    }) => {
      if (mode === "create") return createPosOrder(payload);
      if (mode === "edit" && order) return updatePosOrder(order.id, { ...payload, version: version! });
      if (mode === "add" && order) return addPosOrderItems(order.id, version!, payload.items);
      throw new Error("Invalid save");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-orders"] });
      setFormMode(null);
      setActiveOrder(null);
    },
  });

  const handlePaid = (order: OrderResponse) => {
    setPayOrder(order);
  };

  const confirmPayment = (upiTxnLast5?: string) => {
    if (!payOrder) return;
    action.mutate({ type: "paid", order: payOrder, upiTxnLast5 });
  };

  const handleCancel = (order: OrderResponse) => {
    if (!confirm(`Cancel ${order.order_number}?`)) return;
    action.mutate({ type: "cancel", order });
  };

  const handleComplete = (order: OrderResponse) => {
    action.mutate({ type: "complete", order });
  };

  const handleFormSubmit = (payload: CreateOrderPayload, version?: number) => {
    if (!formMode || formMode === "create") {
      saveOrder.mutate({ mode: "create", payload });
    } else if (formMode === "edit" && activeOrder) {
      saveOrder.mutate({ mode: "edit", payload, order: activeOrder, version: version ?? activeOrder.version });
    } else if (formMode === "add" && activeOrder) {
      saveOrder.mutate({ mode: "add", payload, order: activeOrder, version: version ?? activeOrder.version });
    }
  };

  const { unpaid, paid, completedToday } = useMemo(() => {
    const u = orders.filter((o) => o.order_status === "PENDING_PAYMENT");
    const p = orders.filter((o) =>
      PAID_STATUSES.includes(o.order_status as (typeof PAID_STATUSES)[number])
    );
    const c = orders
      .filter((o) => o.order_status === "COMPLETED")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { unpaid: u, paid: p, completedToday: c };
  }, [orders]);

  const openNewOrder = () => {
    setFormMode("create");
    setActiveOrder(null);
  };

  const cardHandlers = {
    onPaid: handlePaid,
    onCancel: handleCancel,
    onEdit: (o: OrderResponse) => {
      setActiveOrder(o);
      setFormMode("edit");
    },
    onAddItems: (o: OrderResponse) => {
      setActiveOrder(o);
      setFormMode("add");
    },
    onComplete: handleComplete,
    busy: action.isPending || saveOrder.isPending,
  };

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <>
      <header className="pos-header px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">404 Café · POS</h1>
          <p className="text-sm pos-muted">{session?.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={cafeClosed}
            onClick={openNewOrder}
            className="pos-btn pos-btn-primary pos-btn-lg"
          >
            + New order
          </button>
          <button type="button" onClick={() => refetch()} className="pos-btn">
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              clearSession();
              router.push("/login");
            }}
            className="pos-btn"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 space-y-6">
        {cafeClosed && (
          <div className="pos-card border-l-4 border-l-amber-500 bg-amber-50">
            <p className="font-medium text-sm">Cafe is closed</p>
            <p className="text-sm pos-muted mt-0.5">
              New orders disabled until admin opens the cafe. You can still manage existing orders.
            </p>
          </div>
        )}

        {(action.error || saveOrder.error) && (
          <div className="pos-card border-l-4 border-l-red-500 bg-red-50 text-sm text-red-700">
            {(action.error ?? saveOrder.error)?.message}
          </div>
        )}

        {isLoading && <p className="pos-muted text-sm">Loading orders…</p>}
        {error && <p className="text-red-600 text-sm">Failed to load orders.</p>}

        {!isLoading && !error && (
          <>
            <section className="space-y-3">
              <h2 className="pos-section-title">
                Awaiting payment
                <span className={`pos-badge ${unpaid.length > 0 ? "pos-badge-warn" : ""}`}>
                  {unpaid.length}
                </span>
              </h2>
              <OrderGrid
                orders={unpaid}
                emptyMessage="No unpaid orders."
                {...cardHandlers}
              />
            </section>

            <section className="space-y-3">
              <h2 className="pos-section-title">
                Paid orders
                <span className="pos-badge">{paid.length}</span>
              </h2>
              <OrderGrid
                orders={paid}
                emptyMessage="No paid orders right now."
                {...cardHandlers}
              />
            </section>

            <section className="space-y-3">
              <h2 className="pos-section-title">
                Completed today
                <span className="pos-badge">{completedToday.length}</span>
                <span className="text-xs font-normal pos-muted">{todayLabel}</span>
              </h2>
              <OrderGrid
                orders={completedToday}
                emptyMessage="No completed orders yet today."
                {...cardHandlers}
              />
            </section>
          </>
        )}
      </main>

      {formMode && (
        <PosOrderForm
          mode={formMode}
          order={activeOrder ?? undefined}
          onClose={() => {
            setFormMode(null);
            setActiveOrder(null);
          }}
          onSubmit={handleFormSubmit}
          busy={saveOrder.isPending}
          ordersDisabled={cafeClosed && formMode === "create"}
        />
      )}

      {payOrder && (
        <PaymentConfirmModal
          order={payOrder}
          busy={action.isPending}
          onClose={() => setPayOrder(null)}
          onConfirm={confirmPayment}
        />
      )}
    </>
  );
}

export default function PosPage() {
  return (
    <StaffGate roles={["STAFF", "ADMIN", "KITCHEN"]}>
      <PosDashboard />
    </StaffGate>
  );
}
