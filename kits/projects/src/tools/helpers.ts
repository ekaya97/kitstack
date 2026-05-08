/** Format a number as EUR currency (German locale). */
export function fmtEur(amount: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

/** Format minutes as a human-readable duration string. */
export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/** Today's date as YYYY-MM-DD. */
export function today(): string {
  return localIso(new Date());
}

/** Format a Date as YYYY-MM-DD. */
export function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Resolve a named period to a [start, end] ISO date range. */
export function resolvePeriod(period?: string, from?: string, to?: string): [string, string] {
  if (from && to) return [from, to];

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "this_week": {
      const d = new Date(now);
      const day = d.getDay() || 7; // Monday = 1
      d.setDate(d.getDate() - day + 1);
      const start = localIso(d);
      d.setDate(d.getDate() + 6);
      return [start, localIso(d)];
    }
    case "last_week": {
      const d = new Date(now);
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day - 6);
      const start = localIso(d);
      d.setDate(d.getDate() + 6);
      return [start, localIso(d)];
    }
    case "this_month":
      return [isoDate(y, m, 1), isoDate(y, m + 1, 0)];
    case "last_month":
      return [isoDate(y, m - 1, 1), isoDate(y, m, 0)];
    case "this_year":
      return [isoDate(y, 0, 1), isoDate(y, 11, 31)];
    default:
      return [isoDate(y, m, 1), isoDate(y, m + 1, 0)];
  }
}

function isoDate(year: number, month: number, day: number): string {
  return localIso(new Date(year, month, day));
}
