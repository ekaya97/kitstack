import { useState, useMemo } from "react";
import { AppShell } from "@shared/app-shell";
import { useAppData } from "@shared/use-app-data";
import type { Expense } from "@shared/types";

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function formatDateDE(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function SteuerberaterExport() {
  const { data: expenses, loading, error, refetch } = useAppData<Expense>("expenses");
  const [dateFrom, setDateFrom] = useState("2026-04-01");
  const [dateTo, setDateTo] = useState("2026-04-30");

  const filtered = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter((e) => e.date >= dateFrom && e.date <= dateTo);
  }, [expenses, dateFrom, dateTo]);

  const totalGross = filtered.reduce((s, e) => s + e.gross, 0);
  const totalNet = filtered.reduce((s, e) => s + e.net, 0);
  const totalVat = totalGross - totalNet;

  return (
    <AppShell title="Steuerberater Export" loading={loading} error={error} onRetry={refetch}>
      {/* Date range selector */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-xs text-ks-muted">
          Von:
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="ml-1.5 px-2 py-1 text-sm border border-ks-hair rounded bg-white focus:outline-none focus:border-ks-accent font-mono"
          />
        </label>
        <label className="text-xs text-ks-muted">
          Bis:
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="ml-1.5 px-2 py-1 text-sm border border-ks-hair rounded bg-white focus:outline-none focus:border-ks-accent font-mono"
          />
        </label>
        <button
          onClick={() => window.print()}
          className="ml-auto px-4 py-1.5 text-xs font-medium rounded-full border border-ks-hair hover:bg-ks-paper-warm transition-colors print:hidden"
        >
          Drucken
        </button>
      </div>

      {/* Print-friendly table */}
      <div className="border border-ks-hair rounded-lg overflow-hidden print:border-black print:rounded-none">
        <table className="w-full text-sm print:text-xs">
          <thead className="bg-ks-paper-warm border-b border-ks-hair print:bg-gray-100">
            <tr>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Datum</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Beschreibung</th>
              <th className="text-right px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Brutto</th>
              <th className="text-right px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Netto</th>
              <th className="text-right px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">MwSt</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Kategorie</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">SKR03</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-ks-hair/50 print:border-gray-300">
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{formatDateDE(e.date)}</td>
                <td className="px-3 py-2">{e.description}</td>
                <td className="px-3 py-2 font-mono text-xs text-right">{formatEur(e.gross)}</td>
                <td className="px-3 py-2 font-mono text-xs text-right">{formatEur(e.net)}</td>
                <td className="px-3 py-2 font-mono text-xs text-right">{e.vat_rate}%</td>
                <td className="px-3 py-2 text-xs">{e.category}</td>
                <td className="px-3 py-2 font-mono text-xs text-ks-faint">{e.skr03}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-ks-faint">
                  Keine Ausgaben im Zeitraum
                </td>
              </tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-ks-paper-warm border-t border-ks-hair font-medium print:bg-gray-100">
              <tr>
                <td className="px-3 py-2 text-xs" colSpan={2}>Summe ({filtered.length} Posten)</td>
                <td className="px-3 py-2 font-mono text-xs text-right">{formatEur(totalGross)}</td>
                <td className="px-3 py-2 font-mono text-xs text-right">{formatEur(totalNet)}</td>
                <td className="px-3 py-2 font-mono text-xs text-right">{formatEur(totalVat)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="mt-3 text-[11px] text-ks-faint print:text-gray-500">
        Erstellt am {formatDateDE(new Date().toISOString().split("T")[0])} — KitStack Expense
      </div>
    </AppShell>
  );
}
