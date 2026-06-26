"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExpenseTimelineTable } from "@/components/admin/ExpenseBreakdown";
import { MenuItemCosts } from "@/components/admin/MenuItemCosts";
import {
  createFixedExpense,
  createVariableExpense,
  deleteFixedExpense,
  fetchExpenseTimeline,
  fetchFixedExpenses,
  fetchVariableExpenses,
  updateFixedExpense,
  type FixedExpense,
} from "@/lib/api";

function fixedDailyPaise(amountPaise: number, cycle: string): number {
  if (cycle === "YEARLY") return Math.round(amountPaise / 365);
  if (cycle === "DAILY") return amountPaise;
  return Math.round(amountPaise / 30);
}

function formatFixedExpenseLabel(e: {
  amount: number;
  billing_cycle: string;
  daily_amount: number;
}) {
  const period = (e.amount / 100).toFixed(0);
  const daily = (e.daily_amount / 100).toFixed(0);
  if (e.billing_cycle === "DAILY") return `₹${period}/day`;
  return `₹${period}/${e.billing_cycle.toLowerCase()} · ~₹${daily}/day`;
}

type FixedEdit = {
  name: string;
  amount: string;
  billing_cycle: string;
};

function invalidateFinanceQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["fixed-expenses"] });
  queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  queryClient.invalidateQueries({ queryKey: ["expense-timeline"] });
  queryClient.invalidateQueries({ queryKey: ["daily-trend"] });
  queryClient.invalidateQueries({ queryKey: ["monthly-summary"] });
  queryClient.invalidateQueries({ queryKey: ["monthly-trend"] });
  queryClient.invalidateQueries({ queryKey: ["yearly-summary"] });
  queryClient.invalidateQueries({ queryKey: ["yearly-trend"] });
}

function FixedExpenseRow({
  expense,
  onUpdated,
  onRemoved,
}: {
  expense: FixedExpense;
  onUpdated: () => void;
  onRemoved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<FixedEdit>({
    name: expense.name,
    amount: String(expense.amount / 100),
    billing_cycle: expense.billing_cycle,
  });

  const save = useMutation({
    mutationFn: () => {
      const amount = parseInt(edit.amount, 10);
      if (!edit.name.trim() || Number.isNaN(amount) || amount <= 0) {
        throw new Error("Enter a valid name and amount");
      }
      return updateFixedExpense(expense.id, {
        name: edit.name.trim(),
        amount: amount * 100,
        billing_cycle: edit.billing_cycle,
      });
    },
    onSuccess: () => {
      setEditing(false);
      onUpdated();
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteFixedExpense(expense.id),
    onSuccess: () => onRemoved(),
  });

  const startEdit = () => {
    setEdit({
      name: expense.name,
      amount: String(expense.amount / 100),
      billing_cycle: expense.billing_cycle,
    });
    setEditing(true);
  };

  if (editing) {
    return (
      <div className="admin-card grid gap-3 sm:grid-cols-4 text-sm">
        <input
          required
          value={edit.name}
          onChange={(e) => setEdit({ ...edit, name: e.target.value })}
          className="admin-input sm:col-span-2"
        />
        <input
          required
          type="number"
          min={1}
          value={edit.amount}
          onChange={(e) => setEdit({ ...edit, amount: e.target.value })}
          className="admin-input"
        />
        <select
          value={edit.billing_cycle}
          onChange={(e) => setEdit({ ...edit, billing_cycle: e.target.value })}
          className="admin-input"
        >
          <option value="DAILY">Daily</option>
          <option value="MONTHLY">Monthly</option>
          <option value="YEARLY">Yearly</option>
        </select>
        <div className="sm:col-span-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="admin-btn admin-btn-primary"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => setEditing(false)}
            className="admin-btn"
          >
            Cancel
          </button>
          {save.isError && <span className="text-xs text-red-600 self-center">{save.error.message}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-card flex flex-wrap items-center justify-between gap-3 text-sm">
      <div>
        <p className="font-medium">{expense.name}</p>
        <p className="text-xs admin-muted">{formatFixedExpenseLabel(expense)}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={startEdit} className="admin-btn text-xs">
          Edit
        </button>
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(`Remove "${expense.name}" from fixed expenses?`)) {
              remove.mutate();
            }
          }}
          className="admin-btn text-xs text-red-600 border-red-200 hover:bg-red-50"
        >
          {remove.isPending ? "Removing…" : "Remove"}
        </button>
      </div>
    </div>
  );
}

export default function AdminFinancePage() {
  const queryClient = useQueryClient();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const [fixedForm, setFixedForm] = useState({ name: "", amount: "", billing_cycle: "MONTHLY" });
  const [varForm, setVarForm] = useState({
    expense_date: todayStr,
    category: "",
    amount: "",
    notes: "",
  });

  const [timelinePeriod, setTimelinePeriod] = useState<"daily" | "monthly" | "yearly">("monthly");
  const [timelineYear, setTimelineYear] = useState(today.getFullYear());
  const [timelineMonth, setTimelineMonth] = useState(today.getMonth() + 1);

  const { data: fixed = [] } = useQuery({
    queryKey: ["fixed-expenses"],
    queryFn: fetchFixedExpenses,
  });

  const { data: variable = [] } = useQuery({
    queryKey: ["variable-expenses", todayStr],
    queryFn: () => fetchVariableExpenses(todayStr),
  });

  const { data: timeline } = useQuery({
    queryKey: ["expense-timeline", timelinePeriod, timelineYear, timelineMonth],
    queryFn: () =>
      fetchExpenseTimeline(
        timelinePeriod,
        timelineYear,
        timelinePeriod === "daily" ? timelineMonth : undefined
      ),
  });

  const fixedDailyPreview = useMemo(() => {
    const amt = parseInt(fixedForm.amount, 10);
    if (!amt || amt <= 0) return null;
    return fixedDailyPaise(amt * 100, fixedForm.billing_cycle);
  }, [fixedForm.amount, fixedForm.billing_cycle]);

  const addFixed = useMutation({
    mutationFn: () =>
      createFixedExpense({
        name: fixedForm.name,
        amount: parseInt(fixedForm.amount, 10) * 100,
        billing_cycle: fixedForm.billing_cycle,
      }),
    onSuccess: () => {
      invalidateFinanceQueries(queryClient);
      setFixedForm({ name: "", amount: "", billing_cycle: "MONTHLY" });
    },
  });

  const addVariable = useMutation({
    mutationFn: () =>
      createVariableExpense({
        expense_date: varForm.expense_date,
        category: varForm.category,
        amount: parseInt(varForm.amount, 10) * 100,
        notes: varForm.notes || undefined,
      }),
    onSuccess: () => {
      invalidateFinanceQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["variable-expenses"] });
      setVarForm({ expense_date: todayStr, category: "", amount: "", notes: "" });
    },
  });

  const onFixedChanged = () => invalidateFinanceQueries(queryClient);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Menu item costs</h2>
        <MenuItemCosts />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cost timeline</h2>
        <p className="text-sm admin-muted">
          Fixed (daily allocation) and variable (logged per day) costs across daily, monthly, and yearly views.
        </p>
        <div className="flex flex-wrap gap-2">
          {(["daily", "monthly", "yearly"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setTimelinePeriod(p)}
              className={`admin-tab capitalize ${timelinePeriod === p ? "active" : ""}`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {timelinePeriod === "daily" && (
            <select
              value={timelineMonth}
              onChange={(e) => setTimelineMonth(parseInt(e.target.value, 10))}
              className="admin-input"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleDateString("en-IN", { month: "long" })}
                </option>
              ))}
            </select>
          )}
          {timelinePeriod !== "yearly" && (
            <select
              value={timelineYear}
              onChange={(e) => setTimelineYear(parseInt(e.target.value, 10))}
              className="admin-input"
            >
              {Array.from({ length: 5 }, (_, i) => today.getFullYear() - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
        </div>
        {timeline && timeline.points.length > 0 && (
          <ExpenseTimelineTable period={timelinePeriod} points={timeline.points} />
        )}
        {timeline && timeline.points.length === 0 && (
          <p className="text-sm admin-muted">No data for this period.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Fixed expenses</h2>
        <form
          className="admin-card grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            addFixed.mutate();
          }}
        >
          <input
            required
            placeholder="Name (rent, internet…)"
            value={fixedForm.name}
            onChange={(e) => setFixedForm({ ...fixedForm, name: e.target.value })}
            className="admin-input sm:col-span-2"
          />
          <input
            required
            type="number"
            min={1}
            placeholder={
              fixedForm.billing_cycle === "DAILY" ? "Amount ₹ per day" : "Amount ₹"
            }
            value={fixedForm.amount}
            onChange={(e) => setFixedForm({ ...fixedForm, amount: e.target.value })}
            className="admin-input"
          />
          <select
            value={fixedForm.billing_cycle}
            onChange={(e) => setFixedForm({ ...fixedForm, billing_cycle: e.target.value })}
            className="admin-input"
          >
            <option value="DAILY">Daily</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
          {fixedDailyPreview != null && (
            <p className="sm:col-span-4 text-sm admin-muted">
              {fixedForm.billing_cycle === "DAILY" ? (
                <>
                  Timeline daily cost:{" "}
                  <span className="font-medium text-slate-800">
                    ₹{(fixedDailyPreview / 100).toFixed(0)}/day
                  </span>
                </>
              ) : (
                <>
                  Daily allocation in timeline:{" "}
                  <span className="font-medium text-slate-800">
                    ₹{(fixedDailyPreview / 100).toFixed(0)}/day
                  </span>
                </>
              )}
            </p>
          )}
          <button
            type="submit"
            className="sm:col-span-4 admin-btn admin-btn-primary disabled:opacity-50"
            disabled={addFixed.isPending}
          >
            Add fixed expense
          </button>
        </form>
        <div className="space-y-2">
          {fixed.map((e) => (
            <FixedExpenseRow
              key={e.id}
              expense={e}
              onUpdated={onFixedChanged}
              onRemoved={onFixedChanged}
            />
          ))}
          {fixed.length === 0 && <p className="text-sm admin-muted">No fixed expenses yet.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Variable expenses</h2>
        <p className="text-sm admin-muted">
          Logged amount applies to the selected date and appears in the daily timeline for that day.
        </p>
        <form
          className="admin-card grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            addVariable.mutate();
          }}
        >
          <input
            type="date"
            value={varForm.expense_date}
            onChange={(e) => setVarForm({ ...varForm, expense_date: e.target.value })}
            className="admin-input"
            title="Daily update date for timeline"
          />
          <input
            required
            placeholder="Category"
            value={varForm.category}
            onChange={(e) => setVarForm({ ...varForm, category: e.target.value })}
            className="admin-input"
          />
          <input
            required
            type="number"
            min={1}
            placeholder="Amount ₹"
            value={varForm.amount}
            onChange={(e) => setVarForm({ ...varForm, amount: e.target.value })}
            className="admin-input"
          />
          <input
            placeholder="Notes"
            value={varForm.notes}
            onChange={(e) => setVarForm({ ...varForm, notes: e.target.value })}
            className="admin-input"
          />
          <button
            type="submit"
            className="sm:col-span-2 admin-btn admin-btn-primary disabled:opacity-50"
            disabled={addVariable.isPending}
          >
            Log expense
          </button>
        </form>
        <div className="space-y-2">
          {variable.map((e) => (
            <div key={e.id} className="admin-card flex justify-between text-sm">
              <span>
                {e.category}
                {e.notes && <span className="block text-xs opacity-60">{e.notes}</span>}
              </span>
              <span>₹{(e.amount / 100).toFixed(0)}</span>
            </div>
          ))}
          {variable.length === 0 && (
            <p className="text-sm admin-muted">No variable expenses logged for today.</p>
          )}
        </div>
      </section>
    </div>
  );
}
