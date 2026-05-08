import { useMemo } from "react";
import { useKit } from "@kitstackco/sdk/view";

type CategoryItem = { category: string; total: number };
type TrendItem = { month: string; total: number };
type RecentExpense = { id: string; date: string; description: string; amountCents: number; category: string };

type Data = {
  monthExpenses: number;
  monthIncome: number;
  profit: number;
  trend: TrendItem[];
  categoryBreakdown: CategoryItem[];
  recentExpenses: RecentExpense[];
};

const CATEGORY_COLORS: Record<string, string> = {
  software: "#6366f1",
  travel: "#f59e0b",
  meals_business: "#10b981",
  meals_personal: "#84cc16",
  office_supplies: "#8b5cf6",
  phone_internet: "#06b6d4",
  advertising: "#ec4899",
  education: "#14b8a6",
  hardware: "#f97316",
  rent: "#64748b",
  insurance: "#a855f7",
  professional_services: "#0ea5e9",
  transport: "#eab308",
  misc: "#94a3b8",
};

function fmtEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function DashboardView() {
  const { data } = useKit<Data>();
  const d = data ?? { monthExpenses: 0, monthIncome: 0, profit: 0, trend: [], categoryBreakdown: [], recentExpenses: [] };

  const maxTrend = useMemo(() => Math.max(...d.trend.map((t) => t.total), 1), [d.trend]);
  const catTotal = useMemo(() => d.categoryBreakdown.reduce((s, c) => s + c.total, 0), [d.categoryBreakdown]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">Expenses</h1>
        <span className="font-mono text-[10px] text-ks-faint tracking-wider">KITSTACK</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Expenses</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{fmtEur(d.monthExpenses)}</div>
          <div className="text-[11px] text-ks-muted">this month</div>
        </div>
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Income</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{fmtEur(d.monthIncome)}</div>
          <div className="text-[11px] text-ks-muted">this month</div>
        </div>
        <div className={`rounded-lg p-3 ${d.profit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
          <div className={`text-[10px] uppercase tracking-wider ${d.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {d.profit >= 0 ? "Profit" : "Loss"}
          </div>
          <div className={`font-mono text-lg font-semibold mt-0.5 ${d.profit >= 0 ? "text-emerald-800" : "text-red-800"}`}>
            {fmtEur(Math.abs(d.profit))}
          </div>
        </div>
      </div>

      {/* Spending trend */}
      {d.trend.length > 0 && (
        <div className="mb-5">
          <h2 className="font-serif text-base mb-3">Spending Trend</h2>
          <div className="flex items-end gap-2 h-24">
            {d.trend.map((t) => {
              const h = (t.total / maxTrend) * 100;
              return (
                <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[9px] font-mono text-ks-muted">{t.total > 0 ? fmtEur(t.total) : ""}</div>
                  <div
                    className="w-full bg-ks-accent rounded-t"
                    style={{ height: `${Math.max(h, t.total > 0 ? 4 : 0)}%` }}
                  />
                  <div className="text-[10px] text-ks-faint">{t.month}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {d.categoryBreakdown.length > 0 && (
        <div className="mb-5">
          <h2 className="font-serif text-base mb-3">By Category</h2>
          <div className="flex flex-col gap-1.5">
            {d.categoryBreakdown.map((c) => {
              const pct = catTotal > 0 ? (c.total / catTotal) * 100 : 0;
              const color = CATEGORY_COLORS[c.category] ?? "#94a3b8";
              return (
                <div key={c.category} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-ks-muted truncate">{c.category.replace(/_/g, " ")}</div>
                  <div className="flex-1 h-5 bg-ks-paper-warm rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: color }} />
                  </div>
                  <div className="w-20 text-right font-mono text-[11px] text-ks-muted">{fmtEur(c.total)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      {d.recentExpenses.length > 0 && (
        <div>
          <h2 className="font-serif text-base mb-2">Recent Expenses</h2>
          <div className="flex flex-col gap-1">
            {d.recentExpenses.map((e) => (
              <div key={e.id} className="flex items-center gap-2 py-1.5 text-sm border-b border-ks-hair/30 last:border-0">
                <span className="text-[11px] text-ks-faint w-20">{e.date}</span>
                <span className="flex-1 text-[13px] truncate">{e.description}</span>
                <span className="text-[10px] text-ks-muted">{e.category.replace(/_/g, " ")}</span>
                <span className="font-mono text-[12px] font-medium w-20 text-right">{fmtEur(e.amountCents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
