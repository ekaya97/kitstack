import { useMemo } from "react";
import { AppShell } from "@shared/app-shell";
import { useAppData } from "@shared/use-app-data";
import type { Expense, QuarterlySummary } from "@shared/types";

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

const CATEGORY_COLORS: Record<string, string> = {
  "Bürobedarf": "bg-blue-400",
  "Software": "bg-violet-400",
  "Reisekosten": "bg-amber-400",
  "Bewirtung": "bg-orange-400",
  "Fachliteratur": "bg-teal-400",
  "Server/Hosting": "bg-indigo-400",
  "Steuerberatung": "bg-rose-400",
  "Porto": "bg-lime-400",
  "Telekommunikation": "bg-cyan-400",
};

function getBarColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "bg-ks-accent";
}

export function CategoryDashboard() {
  const { data: expenses, loading: el, error, refetch } = useAppData<Expense>("expenses");
  const { data: summaries, loading: sl } = useAppData<QuarterlySummary>("quarterly_summaries");
  const loading = el || sl;

  const stats = useMemo(() => {
    if (!expenses) return null;
    const totalGross = expenses.reduce((s, e) => s + e.gross, 0);
    const totalNet = expenses.reduce((s, e) => s + e.net, 0);
    const totalVat = totalGross - totalNet;

    const byCategory = new Map<string, { category: string; skr03: string; gross: number; net: number }>();
    expenses.forEach((e) => {
      const existing = byCategory.get(e.category);
      if (existing) {
        existing.gross += e.gross;
        existing.net += e.net;
      } else {
        byCategory.set(e.category, { category: e.category, skr03: e.skr03, gross: e.gross, net: e.net });
      }
    });
    const categories = [...byCategory.values()].sort((a, b) => b.gross - a.gross);
    const maxCatGross = Math.max(...categories.map((c) => c.gross), 1);

    return { totalGross, totalNet, totalVat, categories, maxCatGross };
  }, [expenses]);

  const summary = summaries?.[0] ?? null;

  return (
    <AppShell title="Category Dashboard" loading={loading} error={error} onRetry={refetch}>
      {stats && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-ks-paper-warm rounded-lg p-3">
              <div className="text-[10px] text-ks-faint uppercase tracking-wider">Total Gross</div>
              <div className="font-mono text-lg font-semibold mt-0.5">{formatEur(stats.totalGross)}</div>
            </div>
            <div className="bg-ks-paper-warm rounded-lg p-3">
              <div className="text-[10px] text-ks-faint uppercase tracking-wider">Total Net</div>
              <div className="font-mono text-lg font-semibold mt-0.5">{formatEur(stats.totalNet)}</div>
            </div>
            <div className="bg-ks-accent-soft rounded-lg p-3">
              <div className="text-[10px] text-ks-accent-deep uppercase tracking-wider">Total VAT</div>
              <div className="font-mono text-lg font-semibold text-ks-accent-deep mt-0.5">
                {formatEur(stats.totalVat)}
              </div>
            </div>
          </div>

          {/* Category breakdown bar chart */}
          <div className="mb-5">
            <h2 className="font-serif text-base mb-3">By Category (SKR03)</h2>
            <div className="flex flex-col gap-2">
              {stats.categories.map((cat) => {
                const width = (cat.gross / stats.maxCatGross) * 100;
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <div className="w-32 text-xs text-ks-muted truncate" title={cat.category}>
                      {cat.category}
                    </div>
                    <div className="flex-1 h-6 bg-ks-paper-warm rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getBarColor(cat.category)}`}
                        style={{ width: `${Math.max(width, 4)}%` }}
                      />
                    </div>
                    <div className="w-28 text-right font-mono text-[11px] text-ks-muted">
                      <span className="text-ks-faint">{cat.skr03}</span> {formatEur(cat.gross)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly breakdown */}
          {summary && (
            <div>
              <h2 className="font-serif text-base mb-2">Monthly Breakdown</h2>
              <div className="border border-ks-hair rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-ks-paper-warm border-b border-ks-hair">
                    <tr>
                      <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Month</th>
                      <th className="text-right px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Gross</th>
                      <th className="text-right px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Net</th>
                      <th className="text-right px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">VAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.monthly_breakdown.map((m) => (
                      <tr key={m.month} className="border-b border-ks-hair/50">
                        <td className="px-3 py-2.5">{m.month}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-right">{formatEur(m.gross)}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-right">{formatEur(m.net)}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-right">{formatEur(m.vat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
