// Shared presentational bits for the Fressnapf views.

export const eur = (n: number): string =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export function Stars({ value, count }: { value: number; count?: number }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-ks-muted">
      <span className="text-ks-star tracking-[-1px]" aria-hidden>
        {"★★★★★".slice(0, full)}
        <span className="text-ks-hair">{"★★★★★".slice(full)}</span>
      </span>
      <span className="font-medium text-ks-ink">{value.toFixed(1)}</span>
      {count != null && <span className="text-ks-faint">({count})</span>}
    </span>
  );
}

export function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" | "sale" }) {
  const tones: Record<string, string> = {
    muted: "bg-ks-paper-warm text-ks-muted",
    accent: "bg-ks-accent-soft text-ks-accent-deep",
    sale: "bg-ks-sale/10 text-ks-sale",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Prototyp() {
  return (
    <p className="mt-3 text-[10px] leading-tight text-ks-faint">
      Prototyp — Verfügbarkeit und Friends-Punkte simuliert
    </p>
  );
}
