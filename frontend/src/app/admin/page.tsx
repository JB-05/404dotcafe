"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { computeFinanceSnapshot, fetchAdminOverview } from "@/lib/api";

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="paper-card p-4">
      <p className="text-xs uppercase opacity-60">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
    </div>
  );
}

function HourlyChart({ points }: { points: { hour: number; revenue: number }[] }) {
  const max = Math.max(...points.map((p) => p.revenue), 1);
  return (
    <div className="paper-card p-4">
      <p className="text-xs uppercase opacity-60 mb-3">Hourly sales (completed)</p>
      <div className="flex items-end gap-1 h-32">
        {points.map((p) => (
          <div key={p.hour} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-[var(--color-accent)] rounded-t min-h-[2px]"
              style={{ height: `${(p.revenue / max) * 100}%` }}
              title={`${p.hour}:00 — ₹${p.revenue}`}
            />
            {p.hour % 4 === 0 && <span className="text-[10px] opacity-50">{p.hour}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: fetchAdminOverview,
    refetchInterval: 30000,
  });

  const snapshot = useMutation({
    mutationFn: () => computeFinanceSnapshot(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
  });

  if (isLoading) return <p className="text-white/70">Loading dashboard…</p>;
  if (error || !data) return <p className="text-red-400">Failed to load admin overview.</p>;

  const s = data.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/60">Today · {s.date}</p>
        <button
          type="button"
          disabled={snapshot.isPending}
          onClick={() => snapshot.mutate()}
          className="text-sm rounded bg-white/10 px-3 py-1.5 hover:bg-white/20 disabled:opacity-50"
        >
          {snapshot.isPending ? "Saving…" : "Save daily snapshot"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Revenue" value={`₹${s.revenue}`} sub={`${s.completed_orders} completed`} />
        <Metric label="Orders today" value={String(s.order_count)} sub={`${s.pending_orders} pending payment`} />
        <Metric label="Avg order value" value={`₹${s.average_order_value}`} />
        <Metric label="Net profit" value={`₹${s.net_profit}`} sub={`${s.profit_margin_pct}% margin`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="COGS" value={`₹${s.cogs}`} />
        <Metric label="Fixed (daily)" value={`₹${s.fixed_expenses}`} />
        <Metric label="Variable today" value={`₹${s.variable_expenses}`} />
      </div>

      {s.break_even_sales != null && (
        <div className="paper-card p-4 border border-[var(--color-accent)]/40">
          <p className="text-xs uppercase opacity-60">Break-even sales today</p>
          <p className="text-xl font-bold mt-1">₹{s.break_even_sales}</p>
        </div>
      )}

      <HourlyChart points={s.hourly_sales} />

      {data.alerts.length > 0 && (
        <section>
          <h2 className="font-[family-name:var(--font-bebas)] text-xl text-[var(--color-accent)] mb-3">
            LOW STOCK ({data.alerts.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.alerts.map((a) => (
              <div key={a.id} className="paper-card p-3 flex justify-between items-center">
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs opacity-60">
                    {a.current_stock} {a.unit} · threshold {a.threshold}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    a.alert_level === "OUT"
                      ? "bg-red-700 text-white"
                      : a.alert_level === "CRITICAL"
                        ? "bg-amber-600 text-white"
                        : "bg-amber-200 text-black"
                  }`}
                >
                  {a.alert_level}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-4 text-sm">
        <Link href="/admin/inventory" className="text-[var(--color-accent)] hover:underline">
          Manage inventory →
        </Link>
        <Link href="/admin/finance" className="text-[var(--color-accent)] hover:underline">
          Finance & expenses →
        </Link>
      </div>
    </div>
  );
}
