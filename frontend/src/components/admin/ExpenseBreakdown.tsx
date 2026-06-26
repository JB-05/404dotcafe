"use client";

type ExpenseLine = {
  name?: string | null;
  category?: string | null;
  amount: number;
  daily_amount?: number | null;
  billing_cycle?: string | null;
};

function fmtExpense(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function periodAmountLabel(period: "daily" | "monthly" | "yearly") {
  if (period === "daily") return "Day total";
  if (period === "monthly") return "Month total";
  return "Year total";
}

function formatBreakdownLine(
  line: ExpenseLine,
  kind: "fixed" | "variable",
  period: "daily" | "monthly" | "yearly"
) {
  const label = kind === "fixed" ? line.name : line.category;
  const daily = line.daily_amount ?? line.amount;
  const total = fmtExpense(line.amount);
  const dailyStr = fmtExpense(daily);
  if (period === "daily") {
    return `${label}: ${dailyStr}/day`;
  }
  return `${label}: ${total} (${dailyStr}/day)`;
}

export function ExpenseBreakdown({
  fixed,
  variable,
  title = "Expense breakdown",
  period = "daily",
}: {
  fixed: ExpenseLine[];
  variable: ExpenseLine[];
  title?: string;
  period?: "daily" | "monthly" | "yearly";
}) {
  if (fixed.length === 0 && variable.length === 0) return null;

  return (
    <div className="admin-card">
      <p className="admin-card-title mb-3">{title}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">Fixed costs (daily allocation)</p>
          {fixed.length === 0 ? (
            <p className="text-sm admin-muted">No fixed expenses</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {fixed.map((line) => (
                <li key={line.name} className="flex justify-between gap-2">
                  <span>
                    {line.name}
                    {line.billing_cycle && (
                      <span className="text-xs admin-muted ml-1">({line.billing_cycle.toLowerCase()})</span>
                    )}
                  </span>
                  <span className="font-medium text-right">
                    {fmtExpense(line.daily_amount ?? line.amount)}
                    <span className="text-xs admin-muted block">/day</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">Variable costs</p>
          {variable.length === 0 ? (
            <p className="text-sm admin-muted">No variable expenses</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {variable.map((line) => (
                <li key={line.category} className="flex justify-between gap-2">
                  <span>{line.category}</span>
                  <span className="font-medium text-right">
                    {period === "daily" ? (
                      <>
                        {fmtExpense(line.amount)}
                        <span className="text-xs admin-muted block">that day</span>
                      </>
                    ) : (
                      <>
                        {fmtExpense(line.amount)}
                        <span className="text-xs admin-muted block">
                          ~{fmtExpense(line.daily_amount ?? line.amount)}/day
                        </span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function ExpenseTimelineTable({
  period,
  points,
}: {
  period: "daily" | "monthly" | "yearly";
  points: {
    date?: string;
    label?: string;
    year?: number;
    month?: number;
    fixed_expenses: number;
    variable_expenses: number;
    daily_fixed?: number;
    daily_variable?: number;
    fixed_breakdown?: ExpenseLine[];
    variable_breakdown?: ExpenseLine[];
  }[];
}) {
  const sorted = [...points].reverse();
  const totalLabel = periodAmountLabel(period);

  const labelFor = (p: (typeof points)[0]) => {
    if (period === "daily" && p.date) {
      return new Date(p.date + "T12:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
    }
    return p.label ?? String(p.year ?? "");
  };

  return (
    <div className="admin-card overflow-x-auto">
      <p className="admin-card-title mb-3">Cost timeline — daily updates</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Period</th>
            <th>Daily fixed</th>
            <th>Daily variable</th>
            <th>{totalLabel} fixed</th>
            <th>{totalLabel} variable</th>
            <th>Fixed categories</th>
            <th>Variable categories</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const key = p.date ?? p.label ?? `${p.year}-${p.month}`;
            const fixedLines = p.fixed_breakdown ?? [];
            const varLines = p.variable_breakdown ?? [];
            const dailyFixed = p.daily_fixed ?? p.fixed_expenses;
            const dailyVar = p.daily_variable ?? p.variable_expenses;
            return (
              <tr key={key}>
                <td className="font-medium whitespace-nowrap">{labelFor(p)}</td>
                <td className="font-medium">{fmtExpense(dailyFixed)}</td>
                <td className="font-medium">{fmtExpense(dailyVar)}</td>
                <td>{fmtExpense(p.fixed_expenses)}</td>
                <td>{fmtExpense(p.variable_expenses)}</td>
                <td className="text-xs admin-muted max-w-[180px]">
                  {fixedLines.length === 0
                    ? "—"
                    : fixedLines.map((l) => formatBreakdownLine(l, "fixed", period)).join(" · ")}
                </td>
                <td className="text-xs admin-muted max-w-[180px]">
                  {varLines.length === 0
                    ? "—"
                    : varLines.map((l) => formatBreakdownLine(l, "variable", period)).join(" · ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
