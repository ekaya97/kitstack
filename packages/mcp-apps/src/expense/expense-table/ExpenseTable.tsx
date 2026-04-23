import { useState, useMemo } from "react";
import { AppShell } from "@shared/app-shell";
import { useAppData } from "@shared/use-app-data";
import { VAT_COLORS, type Expense } from "@shared/types";

type SortKey = "date" | "description" | "gross" | "net" | "vat_rate" | "category" | "skr03";

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

export function ExpenseTable() {
  const { data: expenses, loading, error, refetch } = useAppData<Expense>("expenses");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    if (!expenses) return [];
    return [...expenses].sort((a, b) => {
      const va = a[sortBy];
      const vb = b[sortBy];
      if (typeof va === "number" && typeof vb === "number") {
        return sortAsc ? va - vb : vb - va;
      }
      return sortAsc
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [expenses, sortBy, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else {
      setSortBy(key);
      setSortAsc(key === "date" ? false : true);
    }
  };

  const SortHeader = ({ label, field, className }: { label: string; field: SortKey; className?: string }) => (
    <th
      className={`text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider cursor-pointer hover:text-ks-ink transition-colors ${className ?? ""}`}
      onClick={() => handleSort(field)}
    >
      {label} {sortBy === field ? (sortAsc ? "\u2191" : "\u2193") : ""}
    </th>
  );

  const totalGross = expenses?.reduce((s, e) => s + e.gross, 0) ?? 0;
  const needsReceipt = sorted.filter((e) => e.gross > 250 && !e.receipt_attached);

  return (
    <AppShell title="Expenses" loading={loading} error={error} onRetry={refetch}>
      <div className="flex items-center gap-4 mb-3 text-xs">
        <div>
          <span className="text-ks-muted">Total Gross: </span>
          <span className="font-mono font-medium">{formatEur(totalGross)}</span>
        </div>
        <div>
          <span className="text-ks-muted">Items: </span>
          <span className="font-mono font-medium">{expenses?.length ?? 0}</span>
        </div>
        {needsReceipt.length > 0 && (
          <div className="text-red-600 font-medium">
            {needsReceipt.length} missing receipt{needsReceipt.length > 1 ? "s" : ""} (&gt;250&euro;)
          </div>
        )}
      </div>

      <div className="border border-ks-hair rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ks-paper-warm border-b border-ks-hair">
            <tr>
              <SortHeader label="Date" field="date" />
              <SortHeader label="Description" field="description" />
              <SortHeader label="Gross" field="gross" />
              <SortHeader label="Net" field="net" />
              <SortHeader label="VAT%" field="vat_rate" />
              <SortHeader label="Category" field="category" />
              <SortHeader label="SKR03" field="skr03" />
              <th className="px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => {
              const flagReceipt = e.gross > 250 && !e.receipt_attached;
              return (
                <tr
                  key={e.id}
                  className={`border-b border-ks-hair/50 transition-colors ${
                    flagReceipt ? "bg-red-50/40" : "hover:bg-ks-paper-warm/40"
                  }`}
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-ks-muted whitespace-nowrap">{e.date}</td>
                  <td className="px-3 py-2.5">{e.description}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-right">{formatEur(e.gross)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-right">{formatEur(e.net)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${VAT_COLORS[e.vat_rate]}`}>
                      {e.vat_rate}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ks-muted text-xs">{e.category}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-ks-faint">{e.skr03}</td>
                  <td className="px-3 py-2.5 text-center">
                    {flagReceipt && (
                      <span className="text-red-500 text-[10px] font-medium" title="Receipt required (>250 EUR)">
                        Beleg fehlt
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-ks-faint">
                  No expenses yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[11px] text-ks-faint">
        {sorted.length} expense{sorted.length !== 1 ? "s" : ""}
      </div>
    </AppShell>
  );
}
