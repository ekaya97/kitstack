import type {
  AgentInstructions,
  AgentLifecycleEvent,
  AgentMessage,
  AgentModelResponse,
  KitContext,
  KitToolResult,
} from "@kitstackco/sdk";
import type { DebriefConfirmationResult, DebriefDraftUpdate } from "./confirmation-contracts.js";

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

export type { NormalizedDebriefSchedule } from "./timing.js";
export { normalizeDebriefSchedule } from "./timing.js";
export type { DebriefConfirmationResult, DebriefDraftUpdate } from "./confirmation-contracts.js";

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
  getDebriefForConfirmation(sessionId: string, context: KitContext): Promise<DebriefConfirmationResult | unknown>;
  updateDebriefDraft(sessionId: string, update: DebriefDraftUpdate, context: KitContext): Promise<DebriefConfirmationResult | unknown>;
  confirmDebriefDraft(sessionId: string, context: KitContext): Promise<DebriefConfirmationResult | unknown>;
  confirmDebrief(sessionId: string, outcome: "confirmed" | "partial", context: KitContext): Promise<unknown>;
  teachFromCorrection(sessionId: string, correction: string, context: KitContext): Promise<unknown>;
}

export type DebriefToolHandler = (
  db: unknown,
  args: Record<string, unknown>,
  ctx: KitContext,
) => Promise<KitToolResult>;
