"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createFixedExpense,
  createVariableExpense,
  fetchFixedExpenses,
  fetchVariableExpenses,
} from "@/lib/api";

export default function AdminFinancePage() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [fixedForm, setFixedForm] = useState({ name: "", amount: "", billing_cycle: "MONTHLY" });
  const [varForm, setVarForm] = useState({
    expense_date: today,
    category: "",
    amount: "",
    notes: "",
  });

  const { data: fixed = [] } = useQuery({
    queryKey: ["fixed-expenses"],
    queryFn: fetchFixedExpenses,
  });

  const { data: variable = [] } = useQuery({
    queryKey: ["variable-expenses", today],
    queryFn: () => fetchVariableExpenses(today),
  });

  const addFixed = useMutation({
    mutationFn: () =>
      createFixedExpense({
        name: fixedForm.name,
        amount: parseInt(fixedForm.amount, 10) * 100,
        billing_cycle: fixedForm.billing_cycle,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
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
      queryClient.invalidateQueries({ queryKey: ["variable-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      setVarForm({ expense_date: today, category: "", amount: "", notes: "" });
    },
  });

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-bebas)] text-xl">Fixed expenses</h2>
        <form
          className="paper-card p-4 grid gap-3 sm:grid-cols-4"
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
            className="sm:col-span-2 rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
          />
          <input
            required
            type="number"
            min={1}
            placeholder="Amount ₹"
            value={fixedForm.amount}
            onChange={(e) => setFixedForm({ ...fixedForm, amount: e.target.value })}
            className="rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
          />
          <select
            value={fixedForm.billing_cycle}
            onChange={(e) => setFixedForm({ ...fixedForm, billing_cycle: e.target.value })}
            className="rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
          <button
            type="submit"
            className="sm:col-span-4 rounded bg-[var(--color-ink)] text-white py-2 text-sm disabled:opacity-50"
            disabled={addFixed.isPending}
          >
            Add fixed expense
          </button>
        </form>
        <div className="space-y-2">
          {fixed.map((e) => (
            <div key={e.id} className="paper-card p-3 flex justify-between text-sm">
              <span>{e.name}</span>
              <span>
                ₹{(e.amount / 100).toFixed(0)}/{e.billing_cycle.toLowerCase()} · ~₹
                {(e.daily_amount / 100).toFixed(0)}/day
              </span>
            </div>
          ))}
          {fixed.length === 0 && <p className="text-sm text-white/50">No fixed expenses yet.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-bebas)] text-xl">Variable expenses (today)</h2>
        <form
          className="paper-card p-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            addVariable.mutate();
          }}
        >
          <input
            type="date"
            value={varForm.expense_date}
            onChange={(e) => setVarForm({ ...varForm, expense_date: e.target.value })}
            className="rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
          />
          <input
            required
            placeholder="Category"
            value={varForm.category}
            onChange={(e) => setVarForm({ ...varForm, category: e.target.value })}
            className="rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
          />
          <input
            required
            type="number"
            min={1}
            placeholder="Amount ₹"
            value={varForm.amount}
            onChange={(e) => setVarForm({ ...varForm, amount: e.target.value })}
            className="rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
          />
          <input
            placeholder="Notes"
            value={varForm.notes}
            onChange={(e) => setVarForm({ ...varForm, notes: e.target.value })}
            className="rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
          />
          <button
            type="submit"
            className="sm:col-span-2 rounded bg-[var(--color-ink)] text-white py-2 text-sm disabled:opacity-50"
            disabled={addVariable.isPending}
          >
            Log expense
          </button>
        </form>
        <div className="space-y-2">
          {variable.map((e) => (
            <div key={e.id} className="paper-card p-3 flex justify-between text-sm">
              <span>
                {e.category}
                {e.notes && <span className="block text-xs opacity-60">{e.notes}</span>}
              </span>
              <span>₹{(e.amount / 100).toFixed(0)}</span>
            </div>
          ))}
          {variable.length === 0 && <p className="text-sm text-white/50">No variable expenses logged today.</p>}
        </div>
      </section>
    </div>
  );
}
