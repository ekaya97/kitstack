import { useMemo } from "react";
import type { Infer } from "../../sdk";
import type { loader } from "./loader";

type Data = Infer<typeof loader>;

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

const CATEGORY_COLORS: Record<string, string> = {
  "Miete": "bg-blue-400",
  "Raumkosten": "bg-sky-400",
  "Software/Cloud": "bg-violet-400",
  "Werbekosten": "bg-orange-400",
  "Fahrzeug/Reise": "bg-amber-400",
  "Telekommunikation": "bg-cyan-400",
  "Versicherung": "bg-rose-400",
  "Burobedarf": "bg-lime-400",
  "Beratung": "bg-indigo-400",
  "Fortbildung": "bg-teal-400",
};

function getBarColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "bg-ks-accent";
}

export function CategoryDashboardView({ data }: { data: Data }) {
  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;

    const totalGross = data.reduce((s, e) => s + e.amountGross, 0);
    const totalNet = data.reduce((s, e) => s + (e.amountNet ?? 0), 0);
    const totalVat = totalGross - totalNet;

    const byCategory = new Map<string, { category: string; skr03: string; gross: number; net: number }>();
    data.forEach((e) => {
      const cat = e.category || "Uncategorized";
      const existing = byCategory.get(cat);
      if (existing) {
        existing.gross += e.amountGross;
        existing.net += e.amountNet ?? 0;
      } else {
        byCategory.set(cat, {
          category: cat,
          skr03: e.skr03Account || "—",
          gross: e.amountGross,
          net: e.amountNet ?? 0,
        });
      }
    });
    const categories = [...byCategory.values()].sort((a, b) => b.gross - a.gross);
    const maxCatGross = Math.max(...categories.map((c) => c.gross), 1);

    return { totalGross, totalNet, totalVat, categories, maxCatGross };
  }, [data]);

  if (!stats) {
    return (
      <div className="p-4 text-center text-ks-faint">No expense data available</div>
    );
  }

  return (
    <div className="p-4">
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
    </div>
  );
}
