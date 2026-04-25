import { useState, useMemo } from "react";
import type { Infer } from "../../sdk";
import type { loader } from "./loader";

type Data = Infer<typeof loader>;
type SortKey = "date" | "description" | "amountGross" | "amountNet" | "vatRate" | "category" | "skr03Account";

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

export function ExpenseTableView({ data }: { data: Data }) {
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const va = a[sortBy];
      const vb = b[sortBy];
      if (typeof va === "number" && typeof vb === "number") {
        return sortAsc ? va - vb : vb - va;
      }
      return sortAsc
        ? String(va ?? "").localeCompare(String(vb ?? ""))
        : String(vb ?? "").localeCompare(String(va ?? ""));
    });
  }, [data, sortBy, sortAsc]);

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

  const totalGross = data?.reduce((s, e) => s + e.amountGross, 0) ?? 0;
  const needsReceipt = sorted.filter((e) => e.amountGross > 250 && e.needsReceipt);

  return (
    <div className="p-4">
      <div className="flex items-center gap-4 mb-3 text-xs">
        <div>
          <span className="text-ks-muted">Total Gross: </span>
          <span className="font-mono font-medium">{formatEur(totalGross)}</span>
        </div>
        <div>
          <span className="text-ks-muted">Items: </span>
          <span className="font-mono font-medium">{data?.length ?? 0}</span>
        </div>
        {needsReceipt.length > 0 && (
          <div className="text-red-600 font-medium">
            {needsReceipt.length} missing receipt{needsReceipt.length > 1 ? "s" : ""} (&gt;€250)
          </div>
        )}
      </div>

      <div className="border border-ks-hair rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ks-paper-warm border-b border-ks-hair">
            <tr>
              <SortHeader label="Date" field="date" />
              <SortHeader label="Description" field="description" />
              <SortHeader label="Gross" field="amountGross" />
              <SortHeader label="Net" field="amountNet" />
              <SortHeader label="VAT%" field="vatRate" />
              <SortHeader label="Category" field="category" />
              <SortHeader label="SKR03" field="skr03Account" />
              <th className="px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => {
              const flagReceipt = e.amountGross > 250 && e.needsReceipt;
              return (
                <tr
                  key={e.id}
                  className={`border-b border-ks-hair/50 transition-colors ${
                    flagReceipt ? "bg-red-50/40" : "hover:bg-ks-paper-warm/40"
                  }`}
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-ks-muted whitespace-nowrap">{e.date}</td>
                  <td className="px-3 py-2.5">{e.description}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-right">{formatEur(e.amountGross)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-right">{formatEur(e.amountNet ?? 0)}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-ks-paper-warm text-ks-muted">
                      {((e.vatRate ?? 0) * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ks-muted text-xs">{e.category || "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-ks-faint">{e.skr03Account || "—"}</td>
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
    </div>
  );
}
