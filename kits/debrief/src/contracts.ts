import type {
  AgentInstructions,
  AgentLifecycleEvent,
  AgentMessage,
  AgentModelResponse,
  KitContext,
  KitToolResult,
} from "@kitstackco/sdk";

/** Stable identity used by the kit and its host-provided plugins. */
export const DEBRIEF_KIT_ID = "kit:debrief" as const;

export type DebriefPluginKind =
  | "persistence"
  | "memory"
  | "instructions"
  | "ai"
  | "telemetry"
  | "channel"
  | "trigger"
  | "connector";

export interface DebriefPluginDescriptor {
  readonly id: string;
  readonly kind: DebriefPluginKind;
  readonly version: string;
  readonly capabilities?: readonly string[];
}

export interface DebriefScope {
  readonly orgId: string;
  readonly appId?: string | null;
  readonly sessionId?: string;
  readonly traceId?: string;
  readonly parentId?: string | null;
  readonly kitId?: string;
}

/** Persistence is intentionally abstract; the kit never receives a DB client. */
export interface DebriefPersistencePlugin extends DebriefPluginDescriptor {
  readonly kind: "persistence";
  get<T>(key: string, scope: DebriefScope): Promise<T | null>;
  put<T>(key: string, value: T, scope: DebriefScope): Promise<void>;
  query<T>(query: string, params: readonly unknown[], scope: DebriefScope): Promise<readonly T[]>;
}

export interface DebriefMemoryRecord {
  readonly memoryId: string;
  readonly status: "candidate" | "approved" | "published";
  readonly skill: string;
  readonly correction?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface DebriefMemoryQuery extends DebriefScope {
  readonly limit?: number;
  readonly skill?: string;
  readonly text?: string;
}

export interface DebriefMemoryPlugin extends DebriefPluginDescriptor {
  readonly kind: "memory";
  readRelevant(query: DebriefMemoryQuery): Promise<readonly DebriefMemoryRecord[]>;
  writeCandidate(input: {
    correction: string;
    skill: string;
    context?: Readonly<Record<string, unknown>>;
  }, scope: DebriefScope): Promise<DebriefMemoryRecord>;
  approveCandidate(memoryId: string, scope: DebriefScope): Promise<DebriefMemoryRecord>;
  publishCandidate(memoryId: string, scope: DebriefScope): Promise<DebriefMemoryRecord>;
}

export interface DebriefInstructionRequest {
  readonly context?: "default" | "prebrief" | "voice" | "debrief";
  readonly locale?: string;
}

export interface DebriefResolvedInstructions extends AgentInstructions {
  readonly id: string;
  readonly hash?: string;
  readonly source?: string;
}

export interface DebriefInstructionsPlugin extends DebriefPluginDescriptor {
  readonly kind: "instructions";
  resolve(
    request: DebriefInstructionRequest,
    scope: DebriefScope,
  ): Promise<DebriefResolvedInstructions>;
}

/** AI is a provider boundary; the kit does not know about OpenAI or Twilio. */
export interface DebriefAiPlugin extends DebriefPluginDescriptor {
  readonly kind: "ai";
  complete(input: {
    instructions: AgentInstructions;
    history: readonly AgentMessage[];
    content?: string;
    signal: AbortSignal;
  }): Promise<AgentModelResponse>;
}

export interface DebriefTelemetryPlugin extends DebriefPluginDescriptor {
  readonly kind: "telemetry";
  append(event: AgentLifecycleEvent | DebriefTelemetryEvent): Promise<void>;
}

export interface DebriefTelemetryEvent {
  readonly type: string;
  readonly operation: string;
  readonly outcome?: "success" | "partial" | "error";
  readonly scope: DebriefScope;
}

export type CustomerEventType =
  | "prebrief"
  | "call_completed"
  | "note"
  | "address_discovered"
  | "debrief_confirmed";

export interface PrepareDebriefInput {
  readonly goal: string;
  readonly company: string;
  readonly contact_name: string;
  readonly location: string;
  /** ISO timestamp or HH:mm/HH:mm:ss in callback_timezone. */
  readonly callback_at: string;
  readonly callback_timezone: string;
  readonly buffer_minutes?: number;
}

export interface DebriefViewHint {
  readonly kit_id: "debrief";
  readonly view: string;
  readonly reason?: string;
}

export interface PreparedDebrief {
  readonly session_id: string;
  readonly customer_id: string;
  readonly prebrief: string;
  readonly prebrief_ends_at: string;
  readonly scheduled_call_at: string;
  readonly destination_masked: string;
  readonly kit_view: DebriefViewHint;
}

export interface DebriefConfirmationDraft {
  readonly draft_id: string;
  readonly session_id: string;
  readonly status: "draft" | "confirmed" | "partial";
  readonly fields: Readonly<Record<string, unknown>>;
  readonly updated_at: string;
}

export interface CustomerEvent {
  readonly event_id: string;
  readonly customer_id: string;
  readonly session_id: string;
  readonly type: CustomerEventType;
  readonly occurred_at: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface NormalizedDebriefSchedule {
  readonly callback_at: string;
  readonly callback_timezone: string;
  readonly buffer_minutes: number;
  readonly prebrief_ends_at: string;
  readonly scheduled_call_at: string;
}

/**
 * Resolve the presenter-facing schedule before persistence or provider calls.
 * Time-only callbacks are interpreted in the supplied IANA timezone.
 */
export function normalizeDebriefSchedule(
  input: Pick<PrepareDebriefInput, "callback_at" | "callback_timezone" | "buffer_minutes">,
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
  // A timezone-less ISO value is still interpreted in callback_timezone.
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

export interface DebriefCapabilities {
  readonly persistence: DebriefPersistencePlugin;
  readonly memory: DebriefMemoryPlugin;
  readonly instructions: DebriefInstructionsPlugin;
  readonly telemetry: DebriefTelemetryPlugin;
  readonly ai?: DebriefAiPlugin;
}

/** Host adapter boundary for the existing MCP/tool surface. */
export interface DebriefOperations {
  prepareDebrief(input: PrepareDebriefInput, context: KitContext): Promise<PreparedDebrief | unknown>;
  getSession(sessionId: string, context: KitContext): Promise<unknown>;
  getDebrief(sessionId: string, context: KitContext): Promise<unknown>;
  confirmDebrief(sessionId: string, outcome: "confirmed" | "partial", context: KitContext): Promise<unknown>;
  teachFromCorrection(sessionId: string, correction: string, context: KitContext): Promise<unknown>;
}

export type DebriefToolHandler = (
  db: unknown,
  args: Record<string, unknown>,
  ctx: KitContext,
) => Promise<KitToolResult>;
