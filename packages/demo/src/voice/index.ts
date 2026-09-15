import type { DebriefSession } from "../debrief/index.js";
import type { TelemetryEventInput, TelemetryStore } from "../telemetry/index.js";

export const SIMULATOR_PROVIDER = "simulator" as const;
export const SIMULATOR_MODEL = "simulator-german-sales-v1";
export type VoiceStatus = "calling" | "awaiting_confirmation" | "partial" | "confirmed" | "failed";
export type Completion = "confirmed" | "partial";

export interface GermanTurnMetadata { turnId: string; sequence: number; speaker: "agent" | "prospect"; locale: "de-DE"; promptKey: string; direction: "inbound" | "outbound"; durationMs: number; }
export interface VoiceResult { sessionId: string; provider: typeof SIMULATOR_PROVIDER; model: string; status: VoiceStatus; locale: "de-DE"; recording: false; retention: false; turns: readonly GermanTurnMetadata[]; error?: string; }
export interface VoiceStatusResult extends Omit<VoiceResult, "turns"> { debriefState: DebriefSession["state"]; }
export interface VoiceSimulatorOptions {
  debrief: { markCalling(sessionId: string): Promise<unknown>; awaitConfirmation(sessionId: string): Promise<unknown>; markPartial?(sessionId: string): Promise<unknown>; confirmDebrief(sessionId: string): Promise<unknown>; markFailed(sessionId: string, error: unknown): Promise<unknown>; getSession(sessionId: string): { state: DebriefSession["state"] } };
  telemetry: Pick<TelemetryStore, "append">; orgId: string; appId: string | null; now?: () => string; createId?: () => string;
}

/** Deterministic, network-free German sales call used for the unreleased demo. */
export class VoiceSimulator {
  private readonly calls = new Map<string, VoiceStatus>();
  private readonly now: () => string; private readonly createId: () => string;
  constructor(private readonly options: VoiceSimulatorOptions) { this.now = options.now ?? (() => new Date().toISOString()); this.createId = options.createId ?? (() => crypto.randomUUID()); }
  async start(sessionId: string): Promise<VoiceResult> { try { await this.options.debrief.markCalling(sessionId); this.calls.set(sessionId, "calling"); await this.emit(sessionId, "start", "started"); return this.result(sessionId, "calling", turns(sessionId)); } catch (error) { this.calls.set(sessionId, "failed"); try { await this.options.debrief.markFailed(sessionId, error); } catch { /* Preserve the original startup error in the result. */ } return { ...this.result(sessionId, "failed", []), error: error instanceof Error ? error.message : String(error) }; } }
  async advance(sessionId: string): Promise<VoiceStatusResult> { this.requireCall(sessionId); await this.options.debrief.awaitConfirmation(sessionId); this.calls.set(sessionId, "awaiting_confirmation"); await this.emit(sessionId, "await_confirmation", "success"); return this.status(sessionId); }
  status(sessionId: string): VoiceStatusResult { const session = this.options.debrief.getSession(sessionId); const state = this.calls.get(sessionId) ?? mapState(session.state); return { ...this.result(sessionId, state, []), debriefState: session.state }; }
  async complete(sessionId: string, completion: Completion): Promise<VoiceStatusResult> { this.requireCall(sessionId); if (completion === "confirmed") { await this.options.debrief.confirmDebrief(sessionId); this.calls.set(sessionId, "confirmed"); await this.emit(sessionId, "complete", "success"); } else { if (!this.options.debrief.markPartial) throw new Error("Debrief service does not support partial completion"); await this.options.debrief.markPartial(sessionId); this.calls.set(sessionId, "partial"); await this.emit(sessionId, "partial", "partial"); } return this.status(sessionId); }
  async fail(sessionId: string, error: unknown): Promise<VoiceStatusResult> { this.requireCall(sessionId); await this.options.debrief.markFailed(sessionId, error); this.calls.set(sessionId, "failed"); await this.emit(sessionId, "provider_error", "error"); return this.status(sessionId); }
  private requireCall(sessionId: string): void { if (!this.calls.has(sessionId)) throw new Error(`Voice call "${sessionId}" has not started`); }
  private result(sessionId: string, status: VoiceStatus, callTurns: readonly GermanTurnMetadata[]): VoiceResult { return { sessionId, provider: SIMULATOR_PROVIDER, model: SIMULATOR_MODEL, status, locale: "de-DE", recording: false, retention: false, turns: callTurns }; }
  private async emit(sessionId: string, operation: string, outcome: "started" | "success" | "partial" | "error"): Promise<void> { const event: TelemetryEventInput = { id: this.createId(), timestamp: this.now(), orgId: this.options.orgId, appId: this.options.appId, sessionId, traceId: sessionId, channel: "voice", kitId: "kit:debrief", type: "voice.call", operation, model: SIMULATOR_MODEL, outcome }; await this.options.telemetry.append(event); }
}

function turns(sessionId: string): readonly GermanTurnMetadata[] { return [["agent", "greeting", "outbound", 900], ["prospect", "needs", "inbound", 1100], ["agent", "value_proposition", "outbound", 1200], ["prospect", "objection", "inbound", 1000], ["agent", "next_step", "outbound", 900]].map(([speaker, promptKey, direction, durationMs], index) => ({ turnId: `${sessionId}-turn-${index + 1}`, sequence: index + 1, speaker: speaker as GermanTurnMetadata["speaker"], locale: "de-DE", promptKey: promptKey as string, direction: direction as GermanTurnMetadata["direction"], durationMs: durationMs as number })); }
function mapState(state: DebriefSession["state"]): VoiceStatus { if (state === "prepared") return "calling"; return state === "calling" || state === "awaiting_confirmation" || state === "partial" || state === "confirmed" || state === "failed" ? state : "failed"; }

export * from "./realtime.js";
