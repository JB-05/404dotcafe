"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  computeFinanceSnapshot,
  fetchAdminOverview,
  fetchDailyTrend,
  fetchMonthlySummary,
  fetchMonthlyTrend,
  fetchYearlySummary,
  fetchYearlyTrend,
  type DailyTrendPoint,
  type FinanceSummary,
  type MonthlySummary,
} from "@/lib/api";
import { CafeControl } from "@/components/admin/CafeControl";
import { ExpenseBreakdown, ExpenseTimelineTable } from "@/components/admin/ExpenseBreakdown";
import { ItemSalesProfitTable } from "@/components/admin/MenuItemCosts";

type View = "daily" | "trend" | "monthly" | "yearly";

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? "+100%" : "—";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function hasDayActivity(summary: FinanceSummary) {
  return (
    summary.revenue > 0 ||
    summary.cogs > 0 ||
    summary.fixed_expenses > 0 ||
    summary.variable_expenses > 0
  );
}

function dayComparisonDelta(current: number, previous: FinanceSummary | undefined, prevValue: number) {
  if (!previous || !hasDayActivity(previous)) return undefined;
  return {
    text: `vs prev day ${pctChange(current, prevValue)}`,
    positive: current >= prevValue,
  };
}

function computeBreakEven(
  revenue: number,
  cogs: number,
  fixedExpenses: number,
  variableExpenses: number
): number | null {
  if (fixedExpenses <= 0) return null;
  const costRate = revenue > 0 ? (cogs + variableExpenses) / revenue : 0;
  if (costRate >= 1) return null;
  return Math.round(fixedExpenses / (1 - costRate));
}

function BreakEvenCard({ amount }: { amount: number }) {
  return (
    <div className="admin-card border-l-4 border-l-blue-500">
      <p className="admin-card-title">Break-even sales</p>
      <p className="admin-metric-value">{fmt(amount)}</p>
      <p className="text-xs admin-muted mt-1">Revenue needed to cover fixed + variable costs at current margins</p>
    </div>
  );
}

const CHART_PLOT_HEIGHT = 120;

function TrendBarChart({
  title,
  points,
  valueKey,
  labelKey,
  barClass = "admin-bar",
  signed = false,
}: {
  title: string;
  points: { [k: string]: string | number }[];
  valueKey: string;
  labelKey: string;
  barClass?: string;
  signed?: boolean;
}) {
  if (points.length === 0) {
    return (
      <div className="admin-card">
        <p className="admin-card-title mb-3">{title}</p>
        <p className="text-sm admin-muted">No data for this period.</p>
      </div>
    );
  }

  const values = points.map((p) => Number(p[valueKey]));
  const labelEvery = points.length <= 14 ? 1 : Math.ceil(points.length / 10);

  if (signed) {
    const maxPos = Math.max(...values, 0);
    const maxNeg = Math.max(...values.map((v) => Math.max(-v, 0)), 0);
    const scale = Math.max(maxPos, maxNeg, 1);
    const posTrack = maxNeg > 0 ? CHART_PLOT_HEIGHT * (maxPos / (maxPos + maxNeg)) : CHART_PLOT_HEIGHT - 8;
    const negTrack = maxPos > 0 ? CHART_PLOT_HEIGHT * (maxNeg / (maxPos + maxNeg)) : 8;

    return (
      <div className="admin-card">
        <p className="admin-card-title mb-3">{title}</p>
        <div className="admin-chart-plot">
          {points.map((p, i) => {
            const value = Number(p[valueKey]);
            const posH =
              value > 0 ? Math.max(3, Math.round((value / scale) * Math.max(posTrack - 4, 0))) : 0;
            const negH =
              value < 0 ? Math.max(3, Math.round((Math.abs(value) / scale) * Math.max(negTrack - 4, 0))) : 0;
            return (
              <div key={i} className="admin-chart-column admin-chart-column-signed">
                <div className="admin-chart-signed-track">
                  <div className="admin-chart-signed-pos">
                    {value > 0 && (
                      <div className={`w-full ${barClass}`} style={{ height: `${posH}px` }} title={`${p[labelKey]}: ${fmt(value)}`} />
                    )}
                  </div>
                  <div className="admin-chart-baseline" />
                  <div className="admin-chart-signed-neg">
                    {value < 0 && (
                      <div
                        className="w-full admin-bar-loss"
                        style={{ height: `${negH}px` }}
                        title={`${p[labelKey]}: ${fmt(value)}`}
                      />
                    )}
                  </div>
                </div>
                {(i % labelEvery === 0 || i === points.length - 1) && (
                  <span className="admin-chart-label">{String(p[labelKey])}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const max = Math.max(...values, 1);

  return (
    <div className="admin-card">
      <p className="admin-card-title mb-3">{title}</p>
      <div className="admin-chart-plot">
        {points.map((p, i) => {
          const value = Number(p[valueKey]);
          const barH = value > 0 ? Math.max(3, Math.round((value / max) * CHART_PLOT_HEIGHT)) : 0;
          return (
            <div key={i} className="admin-chart-column">
              <div className="admin-chart-bar-track">
                <div
                  className={`w-full ${barClass}`}
                  style={{ height: `${barH}px` }}
                  title={`${p[labelKey]}: ${fmt(value)}`}
                />
              </div>
              {(i % labelEvery === 0 || i === points.length - 1) && (
                <span className="admin-chart-label">{String(p[labelKey])}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HourlyChart({ points }: { points: { hour: number; revenue: number }[] }) {
  const max = Math.max(...points.map((pt) => pt.revenue), 1);

  return (
    <div className="admin-card">
      <p className="admin-card-title mb-3">Hourly sales (completed orders)</p>
      <div className="admin-chart-plot">
        {points.map((p) => {
          const barH = p.revenue > 0 ? Math.max(3, Math.round((p.revenue / max) * CHART_PLOT_HEIGHT)) : 0;
          return (
            <div key={p.hour} className="admin-chart-column">
              <div className="admin-chart-bar-track">
                <div
                  className="w-full admin-bar"
                  style={{ height: `${barH}px` }}
                  title={`${p.hour}:00 — ${fmt(p.revenue)}`}
                />
              </div>
              {p.hour % 4 === 0 && <span className="admin-chart-label">{p.hour}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: { text: string; positive: boolean | null };
}) {
  return (
    <div className="admin-card">
      <p className="admin-card-title">{label}</p>
      <p className="admin-metric-value">{value}</p>
      {sub && <p className="text-xs admin-muted mt-1">{sub}</p>}
      {delta && (
        <p
          className={`text-xs mt-1 font-medium ${
            delta.positive === null
              ? "admin-muted"
              : delta.positive
                ? "admin-positive"
                : "admin-negative"
          }`}
        >
          {delta.text}
        </p>
      )}
    </div>
  );
}

function DailyTable({ rows }: { rows: DailyTrendPoint[] }) {
  const sorted = [...rows].reverse();
  return (
    <div className="admin-card overflow-x-auto">
      <p className="admin-card-title mb-3">Daily breakdown</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Revenue</th>
            <th>Orders</th>
            <th>Net profit</th>
            <th>Margin</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.date}>
              <td>{fmtDate(r.date)}</td>
              <td>{fmt(r.revenue)}</td>
              <td>{r.completed_orders}</td>
              <td className={r.net_profit >= 0 ? "admin-positive" : "admin-negative"}>
                {fmt(r.net_profit)}
              </td>
              <td>{r.profit_margin_pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyTable({ rows }: { rows: MonthlySummary[] }) {
  const sorted = [...rows].reverse();
  return (
    <div className="admin-card overflow-x-auto">
      <p className="admin-card-title mb-3">Monthly breakdown</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Revenue</th>
            <th>Orders</th>
            <th>Expenses</th>
            <th>Net profit</th>
            <th>Margin</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={`${r.year}-${r.month}`}>
              <td>{r.label}</td>
              <td>{fmt(r.revenue)}</td>
              <td>{r.completed_orders}</td>
              <td>{fmt(r.cogs + r.fixed_expenses + r.variable_expenses)}</td>
              <td className={r.net_profit >= 0 ? "admin-positive" : "admin-negative"}>
                {fmt(r.net_profit)}
              </td>
              <td>{r.profit_margin_pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayView({
  summary,
  alerts,
  selectedDate,
  onDateChange,
  onSnapshot,
  snapshotPending,
}: {
  summary: FinanceSummary;
  alerts: { id: number; name: string; current_stock: number; unit: string; threshold: number; alert_level: string }[];
  selectedDate: string;
  onDateChange: (d: string) => void;
  onSnapshot: () => void;
  snapshotPending: boolean;
}) {
  const yesterday = useMemo(() => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [selectedDate]);

  const { data: prevData } = useQuery({
    queryKey: ["admin-overview", yesterday],
    queryFn: () => fetchAdminOverview(yesterday),
  });

  const prev = prevData?.summary;
  const isToday = selectedDate === new Date().toISOString().slice(0, 10);
  const totalCosts = summary.cogs + summary.fixed_expenses + summary.variable_expenses;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onDateChange(e.target.value)}
            className="admin-input"
          />
          <span className="text-sm admin-muted">{isToday ? "Today" : fmtDate(selectedDate)}</span>
        </div>
        <button
          type="button"
          disabled={snapshotPending}
          onClick={onSnapshot}
          className="admin-btn admin-btn-primary"
        >
          {snapshotPending ? "Saving…" : "Save snapshot"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Revenue"
          value={fmt(summary.revenue)}
          sub={`${summary.completed_orders} completed · this day only`}
          delta={dayComparisonDelta(summary.revenue, prev, prev?.revenue ?? 0)}
        />
        <Metric
          label="Orders"
          value={String(summary.order_count)}
          sub={`${summary.pending_orders} pending payment`}
        />
        <Metric label="Avg order value" value={fmt(summary.average_order_value)} />
        <Metric
          label="Net profit (this day)"
          value={fmt(summary.net_profit)}
          sub={
            summary.revenue > 0
              ? `${summary.profit_margin_pct}% margin on today's sales`
              : `No sales today · ${fmt(totalCosts)} costs`
          }
          delta={dayComparisonDelta(summary.net_profit, prev, prev?.net_profit ?? 0)}
        />
      </div>

      <p className="text-xs admin-muted -mt-2">
        Net profit = {fmt(summary.revenue)} revenue − {fmt(summary.cogs)} COGS − {fmt(summary.fixed_expenses)} fixed −{" "}
        {fmt(summary.variable_expenses)} variable
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="COGS" value={fmt(summary.cogs)} />
        <Metric label="Fixed (daily)" value={fmt(summary.fixed_expenses)} />
        <Metric label="Variable" value={fmt(summary.variable_expenses)} />
      </div>

      <HourlyChart points={summary.hourly_sales} />

      <ExpenseBreakdown
        fixed={summary.fixed_breakdown ?? []}
        variable={summary.variable_breakdown ?? []}
        title="Daily cost categories"
        period="daily"
      />

      {summary.item_sales && summary.item_sales.length > 0 && (
        <ItemSalesProfitTable rows={summary.item_sales} title="Item profit (completed sales)" />
      )}

      {alerts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3">Low stock ({alerts.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {alerts.map((a) => (
              <div key={a.id} className="admin-card flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{a.name}</p>
                  <p className="text-xs admin-muted">
                    {a.current_stock} {a.unit} · threshold {a.threshold}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    a.alert_level === "OUT"
                      ? "bg-red-100 text-red-700"
                      : a.alert_level === "CRITICAL"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-yellow-50 text-yellow-800"
                  }`}
                >
                  {a.alert_level}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TrendView() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useQuery({
    queryKey: ["daily-trend", days],
    queryFn: () => fetchDailyTrend(days),
  });

  if (isLoading) return <p className="admin-muted">Loading trend data…</p>;
  if (error || !data) return <p className="text-red-600">Failed to load daily trend.</p>;

  const points = data.points;
  const totals = points.reduce(
    (acc, p) => ({
      revenue: acc.revenue + p.revenue,
      orders: acc.orders + p.completed_orders,
      profit: acc.profit + p.net_profit,
    }),
    { revenue: 0, orders: 0, profit: 0 }
  );
  const avgDaily = points.length ? Math.round(totals.revenue / points.length) : 0;

  const chartPoints = points.map((p) => ({
    label: new Date(p.date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    revenue: p.revenue,
    profit: p.net_profit,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[7, 14, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`admin-tab ${days === d ? "active" : ""}`}
          >
            Last {d} days
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={`Total revenue (${days}d)`} value={fmt(totals.revenue)} />
        <Metric label="Total orders" value={String(totals.orders)} />
        <Metric label="Total net profit" value={fmt(totals.profit)} />
        <Metric label="Avg daily revenue" value={fmt(avgDaily)} />
      </div>

      <TrendBarChart title="Daily revenue" points={chartPoints} valueKey="revenue" labelKey="label" />
      <TrendBarChart
        title="Daily net profit"
        points={chartPoints}
        valueKey="profit"
        labelKey="label"
        barClass="admin-bar admin-bar-profit"
        signed
      />
      <DailyTable rows={points} />
      <ExpenseTimelineTable period="daily" points={points} />
    </div>
  );
}

function MonthlyView() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["monthly-summary", year, month],
    queryFn: () => fetchMonthlySummary(year, month),
  });

  const { data: trend } = useQuery({
    queryKey: ["monthly-trend"],
    queryFn: () => fetchMonthlyTrend(12),
  });

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const { data: prevSummary } = useQuery({
    queryKey: ["monthly-summary", prevMonth.year, prevMonth.month],
    queryFn: () => fetchMonthlySummary(prevMonth.year, prevMonth.month),
  });

  const monthlyBreakEven = summary
    ? computeBreakEven(summary.revenue, summary.cogs, summary.fixed_expenses, summary.variable_expenses)
    : null;

  const monthlyChartPoints =
    trend?.points.map((p) => ({
      label: new Date(p.year, p.month - 1, 1).toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
      }),
      revenue: p.revenue,
      profit: p.net_profit,
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value, 10))}
          className="admin-input"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {new Date(2000, m - 1, 1).toLocaleDateString("en-IN", { month: "long" })}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          className="admin-input"
        >
          {Array.from({ length: 5 }, (_, i) => today.getFullYear() - i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="admin-muted">Loading monthly data…</p>}

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Monthly revenue"
              value={fmt(summary.revenue)}
              sub={`${summary.completed_orders} orders`}
              delta={
                prevSummary
                  ? {
                      text: `vs prev month ${pctChange(summary.revenue, prevSummary.revenue)}`,
                      positive: summary.revenue >= prevSummary.revenue,
                    }
                  : undefined
              }
            />
            <Metric label="Avg order value" value={fmt(summary.average_order_value)} />
            <Metric
              label="Net profit"
              value={fmt(summary.net_profit)}
              sub={`${summary.profit_margin_pct}% margin`}
              delta={
                prevSummary
                  ? {
                      text: `vs prev month ${pctChange(summary.net_profit, prevSummary.net_profit)}`,
                      positive: summary.net_profit >= prevSummary.net_profit,
                    }
                  : undefined
              }
            />
            <Metric
              label="Total expenses"
              value={fmt(summary.cogs + summary.fixed_expenses + summary.variable_expenses)}
              sub={`Fixed ${fmt(summary.fixed_expenses)} · Variable ${fmt(summary.variable_expenses)}`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="COGS" value={fmt(summary.cogs)} />
            <Metric label="Fixed (month)" value={fmt(summary.fixed_expenses)} />
            <Metric label="Variable" value={fmt(summary.variable_expenses)} />
          </div>

          <ExpenseBreakdown
            fixed={summary.fixed_breakdown ?? []}
            variable={summary.variable_breakdown ?? []}
            title="Monthly cost categories"
            period="monthly"
          />

          {monthlyBreakEven != null && <BreakEvenCard amount={monthlyBreakEven} />}
        </>
      )}

      {trend && trend.points.length > 0 && (
        <>
          <TrendBarChart
            title="Monthly revenue (last 12 months)"
            points={monthlyChartPoints}
            valueKey="revenue"
            labelKey="label"
          />
          <TrendBarChart
            title="Monthly net profit (last 12 months)"
            points={monthlyChartPoints}
            valueKey="profit"
            labelKey="label"
            barClass="admin-bar admin-bar-profit"
            signed
          />
          <MonthlyTable rows={trend.points} />
          <ExpenseTimelineTable period="monthly" points={trend.points} />
        </>
      )}
    </div>
  );
}

function YearlyView() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());

  const { data: summary, isLoading } = useQuery({
    queryKey: ["yearly-summary", year],
    queryFn: () => fetchYearlySummary(year),
  });

  const { data: trend } = useQuery({
    queryKey: ["yearly-trend"],
    queryFn: () => fetchYearlyTrend(5),
  });

  const yearlyBreakEven = summary
    ? computeBreakEven(summary.revenue, summary.cogs, summary.fixed_expenses, summary.variable_expenses)
    : null;

  const yearlyChartPoints =
    trend?.points.map((p) => ({
      label: p.label,
      revenue: p.revenue,
      profit: p.net_profit,
    })) ?? [];

  return (
    <div className="space-y-6">
      <select
        value={year}
        onChange={(e) => setYear(parseInt(e.target.value, 10))}
        className="admin-input"
      >
        {Array.from({ length: 5 }, (_, i) => today.getFullYear() - i).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      {isLoading && <p className="admin-muted">Loading yearly data…</p>}

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Yearly revenue" value={fmt(summary.revenue)} sub={`${summary.completed_orders} orders`} />
            <Metric label="Avg order value" value={fmt(summary.average_order_value)} />
            <Metric label="Net profit" value={fmt(summary.net_profit)} sub={`${summary.profit_margin_pct}% margin`} />
            <Metric
              label="Total expenses"
              value={fmt(summary.cogs + summary.fixed_expenses + summary.variable_expenses)}
            />
          </div>
          <ExpenseBreakdown
            fixed={summary.fixed_breakdown ?? []}
            variable={summary.variable_breakdown ?? []}
            title="Yearly cost categories"
            period="yearly"
          />

          {yearlyBreakEven != null && <BreakEvenCard amount={yearlyBreakEven} />}
        </>
      )}

      {trend && trend.points.length > 0 && (
        <>
          <TrendBarChart title="Yearly revenue" points={yearlyChartPoints} valueKey="revenue" labelKey="label" />
          <TrendBarChart
            title="Yearly net profit"
            points={yearlyChartPoints}
            valueKey="profit"
            labelKey="label"
            barClass="admin-bar admin-bar-profit"
            signed
          />
          <ExpenseTimelineTable period="yearly" points={trend.points} />
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [view, setView] = useState<View>("daily");
  const [selectedDate, setSelectedDate] = useState(today);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview", selectedDate],
    queryFn: () => fetchAdminOverview(selectedDate),
    refetchInterval: view === "daily" && selectedDate === today ? 30000 : false,
  });

  const snapshot = useMutation({
    mutationFn: () => computeFinanceSnapshot(selectedDate),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-overview", selectedDate] }),
  });

  return (
    <div className="space-y-6">
      <CafeControl />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Performance dashboard</h2>
          <p className="text-sm admin-muted">Revenue, orders, and profitability at a glance</p>
        </div>
        <div className="flex gap-2">
          {(
            [
              ["daily", "Daily"],
              ["trend", "Trend"],
              ["monthly", "Monthly"],
              ["yearly", "Yearly"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`admin-tab ${view === key ? "active" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "daily" && (
        <>
          {isLoading && <p className="admin-muted">Loading…</p>}
          {error && <p className="text-red-600">Failed to load dashboard.</p>}
          {data && (
            <DayView
              summary={data.summary}
              alerts={data.alerts}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onSnapshot={() => snapshot.mutate()}
              snapshotPending={snapshot.isPending}
            />
          )}
        </>
      )}

      {view === "trend" && <TrendView />}
      {view === "monthly" && <MonthlyView />}
      {view === "yearly" && <YearlyView />}

      <div className="flex gap-4 text-sm pt-2 border-t border-slate-200">
        <Link href="/admin/inventory" className="text-blue-600 hover:underline">
          Inventory →
        </Link>
        <Link href="/admin/finance" className="text-blue-600 hover:underline">
          Finance & expenses →
        </Link>
      </div>
    </div>
  );
}
