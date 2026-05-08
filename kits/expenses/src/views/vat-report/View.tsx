import { useKit } from "@kitstackco/sdk/view";

type VorsteuerRow = { vatRate: number | null; totalVat: number; totalNet: number; totalGross: number; count: number };

type Data = {
  isKleinunternehmer: boolean;
  quarterLabel: string;
  revenue: number;
  ustCollected: number;
  vorsteuer: VorsteuerRow[];
  totalVorsteuer: number;
  zahllast: number;
};

function fmtEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function VatReportView() {
  const { data } = useKit<Data>();
  const d = data ?? { isKleinunternehmer: false, quarterLabel: "", revenue: 0, ustCollected: 0, vorsteuer: [], totalVorsteuer: 0, zahllast: 0 };

  if (d.isKleinunternehmer) {
    return (
      <div className="p-4">
        <h1 className="font-serif text-xl text-ks-ink mb-4">VAT Report</h1>
        <div className="bg-amber-50 rounded-lg p-4 text-sm">
          <div className="font-medium text-amber-800 mb-1">Kleinunternehmerregelung (§19 UStG)</div>
          <p className="text-amber-700">
            No VAT is collected or deducted. You are exempt from filing UStVA.
            Ensure annual revenue stays below the threshold (currently €22,000).
          </p>
        </div>
      </div>
    );
  }

  const isRefund = d.zahllast < 0;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">VAT Report</h1>
        <span className="text-xs text-ks-muted">{d.quarterLabel}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Revenue</div>
          <div className="font-mono text-base font-semibold mt-0.5">{fmtEur(d.revenue)}</div>
        </div>
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">USt Collected</div>
          <div className="font-mono text-base font-semibold mt-0.5">{fmtEur(d.ustCollected)}</div>
          <div className="text-[10px] text-ks-muted">19%</div>
        </div>
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Vorsteuer</div>
          <div className="font-mono text-base font-semibold mt-0.5">{fmtEur(d.totalVorsteuer)}</div>
          <div className="text-[10px] text-ks-muted">input VAT</div>
        </div>
      </div>

      {/* Vorsteuer breakdown */}
      {d.vorsteuer.length > 0 && (
        <div className="mb-5">
          <h2 className="font-serif text-base mb-2">Vorsteuer by Rate</h2>
          <div className="text-sm">
            <div className="grid grid-cols-5 gap-2 py-1.5 text-[10px] text-ks-faint uppercase tracking-wider border-b border-ks-hair">
              <div>Rate</div><div>Gross</div><div>Net</div><div>VAT</div><div className="text-right">Count</div>
            </div>
            {d.vorsteuer.map((r) => (
              <div key={r.vatRate} className="grid grid-cols-5 gap-2 py-1.5 text-[12px] border-b border-ks-hair/30">
                <div className="font-medium">{r.vatRate ?? 0}%</div>
                <div className="font-mono text-ks-muted">{fmtEur(r.totalGross)}</div>
                <div className="font-mono text-ks-muted">{fmtEur(r.totalNet)}</div>
                <div className="font-mono">{fmtEur(r.totalVat)}</div>
                <div className="text-right text-ks-muted">{r.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zahllast */}
      <div className={`rounded-lg p-4 ${isRefund ? "bg-emerald-50" : "bg-red-50"}`}>
        <div className={`text-[10px] uppercase tracking-wider ${isRefund ? "text-emerald-600" : "text-red-600"}`}>
          {isRefund ? "Refund (Erstattung)" : "Zahllast (Net VAT Liability)"}
        </div>
        <div className={`font-mono text-xl font-semibold mt-1 ${isRefund ? "text-emerald-800" : "text-red-800"}`}>
          {fmtEur(Math.abs(d.zahllast))}
        </div>
        <div className={`text-[11px] mt-1 ${isRefund ? "text-emerald-600" : "text-red-600"}`}>
          {isRefund ? "The Finanzamt owes you this amount." : "You owe this to the Finanzamt."}
        </div>
      </div>
    </div>
  );
}
