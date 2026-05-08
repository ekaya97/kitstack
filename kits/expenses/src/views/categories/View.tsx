import { useMemo } from "react";
import { useKit } from "@kitstackco/sdk/view";

type CategoryRow = { category: string; total: number; count: number };
type Data = CategoryRow[];

const CATEGORY_LABELS: Record<string, string> = {
  office_supplies: "Bürobedarf", software: "Software & Subscriptions", hardware: "Hardware & Equipment",
  travel: "Reisekosten", meals_business: "Bewirtungskosten", meals_personal: "Personal Meals",
  phone_internet: "Telefon & Internet", advertising: "Werbekosten", education: "Fortbildungskosten",
  insurance: "Versicherungen", rent: "Miete", professional_services: "Beratungskosten",
  transport: "Fahrtkosten", misc: "Sonstige Kosten",
};

const CATEGORY_COLORS: string[] = [
  "bg-blue-400", "bg-emerald-400", "bg-amber-400", "bg-purple-400",
  "bg-rose-400", "bg-cyan-400", "bg-orange-400", "bg-indigo-400",
  "bg-teal-400", "bg-pink-400", "bg-lime-400", "bg-sky-400",
  "bg-red-400", "bg-gray-400",
];

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function CategoriesView() {
  const { data } = useKit<Data>();
  const rows = data ?? [];

  const { grandTotal, maxTotal } = useMemo(() => ({
    grandTotal: rows.reduce((s, r) => s + r.total, 0),
    maxTotal: Math.max(...rows.map((r) => r.total), 1),
  }), [rows]);

  if (rows.length === 0) {
    return (
      <div className="p-4 text-center text-ks-muted text-sm">
        No expenses this month yet. Start by logging an expense.
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">Categories</h1>
        <span className="font-mono text-[10px] text-ks-faint tracking-wider">KITSTACK</span>
      </div>

      {/* Total */}
      <div className="bg-ks-paper-warm rounded-lg p-3 mb-5">
        <div className="text-[10px] text-ks-faint uppercase tracking-wider">Total This Month</div>
        <div className="font-mono text-xl font-semibold mt-0.5">{formatCurrency(grandTotal)}</div>
        <div className="text-[11px] text-ks-muted">{rows.reduce((s, r) => s + r.count, 0)} expenses across {rows.length} categories</div>
      </div>

      {/* Stacked bar visualization */}
      <div className="mb-5 rounded-lg overflow-hidden h-8 flex">
        {rows.map((r, i) => {
          const width = (r.total / grandTotal) * 100;
          return (
            <div
              key={r.category}
              className={`${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} h-full transition-all`}
              style={{ width: `${Math.max(width, 1)}%` }}
              title={`${CATEGORY_LABELS[r.category] ?? r.category}: ${formatCurrency(r.total)}`}
            />
          );
        })}
      </div>

      {/* Category bars */}
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => {
          const width = (r.total / maxTotal) * 100;
          const pct = grandTotal > 0 ? ((r.total / grandTotal) * 100).toFixed(1) : "0.0";
          return (
            <div key={r.category}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-sm ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`} />
                  <span className="text-sm text-ks-ink">
                    {CATEGORY_LABELS[r.category] ?? r.category}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-ks-faint">{pct}%</span>
                  <span className="font-mono text-xs font-medium text-ks-accent w-24 text-right">
                    {formatCurrency(r.total)}
                  </span>
                </div>
              </div>
              <div className="h-4 bg-ks-paper-warm rounded-full overflow-hidden">
                <div
                  className={`h-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} rounded-full transition-all opacity-70`}
                  style={{ width: `${Math.max(width, 2)}%` }}
                />
              </div>
              <div className="text-[10px] text-ks-faint mt-0.5">{r.count} expense{r.count !== 1 ? "s" : ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
