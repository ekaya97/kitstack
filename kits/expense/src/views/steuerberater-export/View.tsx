import { useState, useMemo } from "react";
import { useFile } from "@shared/use-kit";
import type { Infer } from "../../sdk";
import type { loader } from "./loader";

type Data = Infer<typeof loader>;

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function formatDateDE(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function SteuerberaterExportView({ data }: { data: Data }) {
  const file = useFile();
  const [dateFrom, setDateFrom] = useState("2026-01-01");
  const [dateTo, setDateTo] = useState("2026-12-31");

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((e) => e.date >= dateFrom && e.date <= dateTo);
  }, [data, dateFrom, dateTo]);

  const totalGross = filtered.reduce((s, e) => s + e.amountGross, 0);
  const totalNet = filtered.reduce((s, e) => s + (e.amountNet ?? 0), 0);
  const totalVat = totalGross - totalNet;

  const handleExport = () => {
    let csv = "Datum;Beschreibung;Brutto;Netto;MwSt-Betrag;MwSt-Satz;Kategorie;SKR03-Konto;Privat;Beleg\n";
    for (const e of filtered) {
      const vatPct = e.vatRate !== null ? `${((e.vatRate ?? 0) * 100).toFixed(0)}%` : "";
      const isPrivate = e.isPrivate ? "Ja" : "Nein";
      const receipt = e.needsReceipt ? "Ausstehend" : "Nicht erforderlich";
      csv += `"${e.date}";"${e.description}";"${e.amountGross.toFixed(2)}";"${(e.amountNet ?? 0).toFixed(2)}";"${(e.vatAmount ?? 0).toFixed(2)}";"${vatPct}";"${e.category || ""}";"${e.skr03Account || ""}";"${isPrivate}";"${receipt}"\n`;
    }
    file.download("steuerberater-export.csv", "text/csv", csv);
  };

  return (
    <div className="p-4">
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
          onClick={handleExport}
          className="ml-auto px-4 py-1.5 text-xs font-medium rounded-full border border-ks-hair hover:bg-ks-paper-warm transition-colors"
        >
          CSV Export
        </button>
      </div>

      {/* Table */}
      <div className="border border-ks-hair rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ks-paper-warm border-b border-ks-hair">
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
              <tr key={e.id} className="border-b border-ks-hair/50">
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{formatDateDE(e.date)}</td>
                <td className="px-3 py-2">{e.description}</td>
                <td className="px-3 py-2 font-mono text-xs text-right">{formatEur(e.amountGross)}</td>
                <td className="px-3 py-2 font-mono text-xs text-right">{formatEur(e.amountNet ?? 0)}</td>
                <td className="px-3 py-2 font-mono text-xs text-right">{((e.vatRate ?? 0) * 100).toFixed(0)}%</td>
                <td className="px-3 py-2 text-xs">{e.category || "\u2014"}</td>
                <td className="px-3 py-2 font-mono text-xs text-ks-faint">{e.skr03Account || "\u2014"}</td>
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
            <tfoot className="bg-ks-paper-warm border-t border-ks-hair font-medium">
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

      <div className="mt-3 text-[11px] text-ks-faint">
        Erstellt am {formatDateDE(new Date().toISOString().split("T")[0])} &mdash; KitStack Expense
      </div>
      {file.feedback && (
        <div className="mt-2 text-xs text-emerald-600 font-medium">{file.feedback}</div>
      )}
    </div>
  );
}
