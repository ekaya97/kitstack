import type { MemoryRecord, MemoryWriteInput } from "../memory/index.js";
import type { InstructionPlugin, ResolvedInstruction } from "../instructions/index.js";
import type { TelemetryEventInput, TelemetryStore } from "../telemetry/index.js";

export type DebriefState = "prepared" | "calling" | "awaiting_confirmation" | "partial" | "confirmed" | "failed";

export interface DebriefContext {
  orgId: string;
  appId: string | null;
  kitId?: string;
  now?: () => string;
  id?: () => string;
}

export interface DebriefSession {
  sessionId: string;
  orgId: string;
  kitId: string;
  state: DebriefState;
  goal: string;
  instructionVersion: string;
  memoryIds: string[];
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface DebriefSummary {
  sessionId: string;
  state: DebriefState;
  goal: string;
  instructionVersion: string;
  memoryIds: string[];
}

export interface MemoryStoreLike {
  writeCandidate(input: MemoryWriteInput, context: any): Promise<MemoryRecord>;
  approveCandidate(memoryId: string, context: any): Promise<MemoryRecord>;
  publishCandidate(memoryId: string, context: any): Promise<MemoryRecord>;
  readRelevant(query: any, context: any): Promise<MemoryRecord[]>;
}

export interface TextInference {
  (input: { goal: string; correction?: string; instruction: ResolvedInstruction; memories: MemoryRecord[] }): Promise<string>;
}

export class DebriefService {
  private readonly sessions = new Map<string, DebriefSession>();
  private readonly now: () => string;
  private readonly id: () => string;

  constructor(
    private readonly memory: MemoryStoreLike,
    private readonly instructions: InstructionPlugin,
    private readonly telemetry: TelemetryStore,
    private readonly context: DebriefContext,
    private readonly infer?: TextInference,
  ) {
    this.now = context.now ?? (() => new Date().toISOString());
    this.id = context.id ?? (() => crypto.randomUUID());
  }

  async prepareDebrief(goal: string): Promise<DebriefSession> {
    const sessionId = this.id();
    const instruction = await this.instructions.resolve({ kitId: this.kitId, context: { name: "prebrief" } }, this.pluginContext(sessionId));
    const memories = await this.memory.readRelevant({ orgId: this.context.orgId, kitId: this.kitId, limit: 20 }, this.memoryContext(sessionId));
    const timestamp = this.now();
    const session: DebriefSession = { sessionId, orgId: this.context.orgId, kitId: this.kitId, state: "prepared", goal, instructionVersion: instruction.version, memoryIds: memories.map((m) => m.memoryId), createdAt: timestamp, updatedAt: timestamp };
    this.sessions.set(sessionId, session);
    await this.emit(session, "prepare", "success");
    return this.getSession(sessionId);
  }

  async markCalling(sessionId: string): Promise<DebriefSession> { return this.transition(sessionId, "calling"); }
  async awaitConfirmation(sessionId: string): Promise<DebriefSession> { return this.transition(sessionId, "awaiting_confirmation"); }
  async confirmDebrief(sessionId: string): Promise<DebriefSession> { return this.transition(sessionId, "confirmed"); }
  async markFailed(sessionId: string, error: unknown): Promise<DebriefSession> {
    const session = this.require(sessionId);
    session.state = "failed";
    session.error = error instanceof Error ? error.message : String(error);
    session.updatedAt = this.now();
    await this.emit(session, "provider_error", "error");
    return this.getSession(sessionId);
  }

  async teachFromCorrection(sessionId: string, correction: string): Promise<MemoryRecord> {
    const session = this.require(sessionId);
    if (session.state !== "awaiting_confirmation" && session.state !== "partial") throw new Error("Teaching requires an awaiting or partial debrief");
    const record = await this.memory.writeCandidate({ correction, skill: "debrief", context: { goal: session.goal } }, this.memoryContext(sessionId));
    session.memoryIds.push(record.memoryId);
    session.state = "partial";
    session.updatedAt = this.now();
    await this.emit(session, "teach", "partial");
    return record;
  }

  async approve(sessionId: string, memoryId: string): Promise<MemoryRecord> { return this.memory.approveCandidate(memoryId, this.memoryContext(sessionId)); }
  async publish(sessionId: string, memoryId: string): Promise<MemoryRecord> { return this.memory.publishCandidate(memoryId, this.memoryContext(sessionId)); }

  getSession(sessionId: string): DebriefSession { const session = this.require(sessionId); return { ...session, memoryIds: [...session.memoryIds] }; }
  getDebrief(sessionId: string): DebriefSummary { const s = this.getSession(sessionId); return { sessionId: s.sessionId, state: s.state, goal: s.goal, instructionVersion: s.instructionVersion, memoryIds: s.memoryIds }; }

  private get kitId(): string { return this.context.kitId ?? "kit:debrief"; }
  private require(id: string): DebriefSession { const session = this.sessions.get(id); if (!session) throw new Error(`Debrief session "${id}" was not found`); return session; }
  private async transition(id: string, state: DebriefState): Promise<DebriefSession> { const s = this.require(id); const allowed = s.state === "prepared" && state === "calling" || s.state === "calling" && state === "awaiting_confirmation" || (s.state === "awaiting_confirmation" || s.state === "partial") && state === "confirmed"; if (!allowed) throw new Error(`Invalid debrief transition ${s.state} -> ${state}`); s.state = state; s.updatedAt = this.now(); await this.emit(s, state === "confirmed" ? "complete" : "state", "success"); return this.getSession(id); }
  private memoryContext(sessionId: string) { return { orgId: this.context.orgId, appId: this.context.appId, sessionId, traceId: sessionId, parentId: null, kitId: this.kitId }; }
  private pluginContext(sessionId: string) { return { ...this.memoryContext(sessionId), telemetry: this.telemetry, lookupPlugin: () => undefined }; }
  private async emit(s: DebriefSession, operation: string, outcome: "success" | "partial" | "error") { const event: TelemetryEventInput = { id: this.id(), timestamp: this.now(), orgId: s.orgId, appId: this.context.appId, sessionId: s.sessionId, traceId: s.sessionId, channel: "voice", pluginId: "kit:debrief", kitId: s.kitId, type: operation === "complete" ? "session.completed" : "voice.call", operation, outcome }; await this.telemetry.append(event); }
}
