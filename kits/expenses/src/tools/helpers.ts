/** Resolve a named period to a [start, end] ISO date range. */
export function resolvePeriod(period?: string, from?: string, to?: string): [string, string] {
  if (from && to) return [from, to];

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  switch (period) {
    case "this_month":
      return [iso(y, m, 1), iso(y, m + 1, 0)];
    case "last_month":
      return [iso(y, m - 1, 1), iso(y, m, 0)];
    case "Q1":
      return [iso(y, 0, 1), iso(y, 2, 31)];
    case "Q2":
      return [iso(y, 3, 1), iso(y, 5, 30)];
    case "Q3":
      return [iso(y, 6, 1), iso(y, 8, 30)];
    case "Q4":
      return [iso(y, 9, 1), iso(y, 11, 31)];
    case "this_year":
      return [iso(y, 0, 1), iso(y, 11, 31)];
    case "last_year":
      return [iso(y - 1, 0, 1), iso(y - 1, 11, 31)];
    default:
      return [iso(y, m, 1), iso(y, m + 1, 0)];
  }
}

function iso(year: number, month: number, day: number): string {
  const d = new Date(year, month, day);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Format cents as EUR string (German locale). */
export function fmtEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** Compute net and VAT from gross cents and VAT rate. */
export function computeVat(grossCents: number, vatRate: number): { netCents: number; vatCents: number } {
  if (vatRate === 0) return { netCents: grossCents, vatCents: 0 };
  const netCents = Math.round(grossCents / (1 + vatRate / 100));
  const vatCents = grossCents - netCents;
  return { netCents, vatCents };
}
