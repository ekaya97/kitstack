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

export interface DebriefCapabilities {
  readonly persistence: DebriefPersistencePlugin;
  readonly memory: DebriefMemoryPlugin;
  readonly instructions: DebriefInstructionsPlugin;
  readonly telemetry: DebriefTelemetryPlugin;
  readonly ai?: DebriefAiPlugin;
}

/** Host adapter boundary for the existing MCP/tool surface. */
export interface DebriefOperations {
  prepareDebrief(goal: string, context: KitContext): Promise<unknown>;
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
