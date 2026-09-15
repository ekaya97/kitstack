export interface NormalizedDebriefSchedule {
  readonly callback_at: string;
  readonly callback_timezone: string;
  readonly buffer_minutes: number;
  readonly prebrief_ends_at: string;
  readonly scheduled_call_at: string;
}

export function normalizeDebriefSchedule(
  input: { callback_at: string; callback_timezone: string; buffer_minutes?: number },
  now: Date = new Date(),
): NormalizedDebriefSchedule {
  const timezone = input.callback_timezone?.trim();
  if (!timezone) throw new Error("callback_timezone is required (use an IANA timezone such as Europe/Berlin)");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(now);
  } catch {
    throw new Error(`callback_timezone must be a valid IANA timezone: ${timezone}`);
  }

  const buffer = input.buffer_minutes ?? 0;
  if (!Number.isInteger(buffer) || buffer < 0 || buffer > 24 * 60) {
    throw new Error("buffer_minutes must be a whole number between 0 and 1440");
  }

  const callbackMs = resolveCallbackAt(input.callback_at, timezone, now);
  const delta = callbackMs - now.getTime();
  if (delta < 0) throw new Error("callback_at must be in the future");
  if (delta > 24 * 60 * 60 * 1000) throw new Error("callback_at must be within the next 24 hours");

  const callback = new Date(callbackMs).toISOString();
  return {
    callback_at: callback,
    callback_timezone: timezone,
    buffer_minutes: buffer,
    prebrief_ends_at: callback,
    scheduled_call_at: new Date(callbackMs + buffer * 60 * 1000).toISOString(),
  };
}

function resolveCallbackAt(value: string, timezone: string, now: Date): number {
  const raw = value?.trim();
  if (!raw) throw new Error("callback_at is required");
  const timeOnly = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (timeOnly) {
    const hour = Number(timeOnly[1]);
    const minute = Number(timeOnly[2]);
    const second = Number(timeOnly[3] ?? 0);
    if (hour > 23 || minute > 59 || second > 59) throw new Error("callback_at must use a valid 24-hour time");
    const current = zonedParts(now, timezone);
    let candidate = zonedDate({ ...current, hour, minute, second, millisecond: 0 }, timezone);
    if (candidate <= now.getTime()) {
      candidate = zonedDate({ ...current, day: current.day + 1, hour, minute, second, millisecond: 0 }, timezone);
    }
    return candidate;
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new Error("callback_at must be an ISO timestamp or HH:mm time");
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const local = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw);
    if (!local) throw new Error("callback_at must include a timezone offset or use callback_timezone");
    return zonedDate({
      year: Number(local[1]), month: Number(local[2]), day: Number(local[3]),
      hour: Number(local[4]), minute: Number(local[5]), second: Number(local[6] ?? 0), millisecond: 0,
    }, timezone);
  }
  return parsed;
}

interface ZonedParts { year: number; month: number; day: number; hour: number; minute: number; second: number; millisecond: number }

function zonedParts(date: Date, timezone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return { year: values.year, month: values.month, day: values.day, hour: values.hour === 24 ? 0 : values.hour, minute: values.minute, second: values.second, millisecond: date.getMilliseconds() };
}

function zonedDate(parts: ZonedParts, timezone: string): number {
  let candidate = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(candidate), timezone);
    const desiredUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
    const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second, actual.millisecond);
    candidate += desiredUtc - actualUtc;
  }
  return candidate;
}
