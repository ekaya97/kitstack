import { useState, useMemo } from "react";
import { AppShell } from "@shared/app-shell";
import { useAppData } from "@shared/use-app-data";
import { VAT_COLORS, type Expense } from "@shared/types";

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

export function ImportReview() {
  const { data: expenses, loading, error, refetch } = useAppData<Expense>("expenses");
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());

  const items = useMemo(() => {
    if (!expenses) return [];
    // Show unconfirmed items for review, plus recently confirmed ones
    return expenses.map((e) => ({
      ...e,
      isConfirmed: e.confirmed || confirmed.has(e.id),
    }));
  }, [expenses, confirmed]);

  const confirmedCount = items.filter((i) => i.isConfirmed).length;
  const uncategorizedCount = items.filter((i) => !i.category || i.category === "Uncategorized").length;
  const pendingCount = items.filter((i) => !i.isConfirmed).length;

  const toggleConfirm = (id: string) => {
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmAll = () => {
    const allIds = items.filter((i) => !i.isConfirmed).map((i) => i.id);
    setConfirmed((prev) => {
      const next = new Set(prev);
      allIds.forEach((id) => next.add(id));
      return next;
    });
  };

  return (
    <AppShell title="Import Review" loading={loading} error={error} onRetry={refetch}>
      {/* Summary bar */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div>
          <span className="text-ks-muted">Total: </span>
          <span className="font-mono font-medium">{items.length}</span>
        </div>
        <div>
          <span className="text-ks-muted">Confirmed: </span>
          <span className="font-mono font-medium text-emerald-700">{confirmedCount}</span>
        </div>
        <div>
          <span className="text-ks-muted">Pending: </span>
          <span className="font-mono font-medium text-amber-700">{pendingCount}</span>
        </div>
        {uncategorizedCount > 0 && (
          <div className="text-red-600 font-medium">
            {uncategorizedCount} uncategorized
          </div>
        )}
        {pendingCount > 0 && (
          <button
            onClick={confirmAll}
            className="ml-auto px-3 py-1 text-xs font-medium rounded-full border border-ks-hair hover:bg-ks-paper-warm transition-colors"
          >
            Confirm All
          </button>
        )}
      </div>

      <div className="border border-ks-hair rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ks-paper-warm border-b border-ks-hair">
            <tr>
              <th className="px-3 py-2 w-8"></th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Date</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Description</th>
              <th className="text-right px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Gross</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">VAT%</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Category</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">SKR03</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => {
              const isUncategorized = !e.category || e.category === "Uncategorized";
              return (
                <tr
                  key={e.id}
                  className={`border-b border-ks-hair/50 transition-colors ${
                    isUncategorized
                      ? "bg-amber-50/50"
                      : e.isConfirmed
                        ? "bg-emerald-50/20"
                        : "hover:bg-ks-paper-warm/40"
                  }`}
                >
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={e.isConfirmed}
                      onChange={() => toggleConfirm(e.id)}
                      className="w-3.5 h-3.5 rounded border-ks-hair text-ks-accent focus:ring-ks-accent cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-ks-muted whitespace-nowrap">{e.date}</td>
                  <td className="px-3 py-2.5">
                    {e.description}
                    {isUncategorized && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                        needs category
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-right">{formatEur(e.gross)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${VAT_COLORS[e.vat_rate]}`}>
                      {e.vat_rate}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ks-muted text-xs">{e.category || "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-ks-faint">{e.skr03}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-ks-faint">
                  No imported expenses to review
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
