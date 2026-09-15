import type { MemoryContext, MemoryRecord, MemoryWriteInput } from "../memory/index.js";
import type { InstructionPlugin, ResolvedInstruction } from "../instructions/index.js";
import type { TelemetryEventInput, TelemetryStore } from "../telemetry/index.js";
import type {
  CustomerEventRecord,
  CustomerIdentityInput,
  CustomerRecord,
  DebriefDraftRecord,
  DebriefDraftStatus,
  DebriefPersistence,
} from "./persistence.js";
import { normalizeDebriefSchedule } from "../../../../kits/debrief/src/timing.js";

export type DebriefState = "prepared" | "calling" | "awaiting_confirmation" | "partial" | "confirmed" | "failed";

export interface DebriefContext {
  orgId: string;
  appId: string | null;
  kitId?: string;
  now?: () => string;
  id?: () => string;
  /** Already-masked destination label; raw phone numbers never enter debrief state. */
  destinationMasked?: string;
}

export interface DebriefSession {
  sessionId: string;
  orgId: string;
  kitId: string;
  state: DebriefState;
  goal: string;
  customerId: string | null;
  callbackAt: string | null;
  scheduledCallAt: string | null;
  callbackTimezone: string | null;
  callId: string | null;
  instructionVersion: string;
  memoryIds: string[];
  createdAt: string;
  updatedAt: string;
  error?: string;
}

/** Internal host shape aligned with the debrief kit's T-0184 input. */
export interface DebriefPreparationInput extends CustomerIdentityInput {
  goal: string;
  callbackAt?: string;
  scheduledCallAt?: string;
  callbackTimezone?: string;
  bufferMinutes?: number;
}

export interface DebriefServiceOptions {
  persistence?: DebriefPersistence;
  initialSessions?: readonly DebriefSession[];
}

export interface DebriefSummary {
  sessionId: string;
  state: DebriefState;
  goal: string;
  instructionVersion: string;
  memoryIds: string[];
}

/** A memory returned by or taught during a particular debrief session. */
export interface TaughtMemoryOperationInput {
  sessionId: string;
  memoryId: string;
}

/** Public input for moving a taught candidate to the approved state. */
export interface ApproveMemoryInput extends TaughtMemoryOperationInput {}

/** Public input for publishing an approved taught memory for later runs. */
export interface PublishMemoryInput extends TaughtMemoryOperationInput {}

export interface MemoryStoreLike {
  writeCandidate(input: MemoryWriteInput, context: MemoryContext): Promise<MemoryRecord>;
  approveCandidate(memoryId: string, context: MemoryContext): Promise<MemoryRecord>;
  publishCandidate(memoryId: string, context: MemoryContext): Promise<MemoryRecord>;
  readRelevant(query: any, context: MemoryContext): Promise<MemoryRecord[]>;
}

export interface TextInference {
  (input: {
    goal: string;
    correction?: string;
    instruction: ResolvedInstruction;
    memories: MemoryRecord[];
    customer?: CustomerRecord;
    events?: CustomerEventRecord[];
    sections?: PrebriefSections;
    sessionId?: string;
  }): Promise<string>;
}

export interface PrebriefSections {
  readonly known: readonly string[];
  readonly last_interaction: string;
  readonly open_items: readonly string[];
  readonly call_objective: string;
}

/** The rich presenter response, retaining the legacy session fields. */
export type PreparedDebriefResult = DebriefSession & {
  readonly session_id: string;
  readonly customer_id: string;
  readonly prebrief: string;
  readonly prebrief_ends_at: string;
  readonly scheduled_call_at: string;
  readonly destination_masked: string;
  readonly kit_view: { readonly kit_id: "debrief"; readonly view: string; readonly reason: string };
  readonly prebrief_sections: PrebriefSections;
};

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
    options: DebriefServiceOptions = {},
  ) {
    this.now = context.now ?? (() => new Date().toISOString());
    this.id = context.id ?? (() => crypto.randomUUID());
    for (const session of options.initialSessions ?? []) {
      this.sessions.set(session.sessionId, cloneSession(session));
    }
    this.persistence = options.persistence;
  }

  private readonly persistence?: DebriefPersistence;

  async prepareDebrief(input: string | DebriefPreparationInput): Promise<DebriefSession | PreparedDebriefResult> {
    const preparation: Partial<DebriefPreparationInput> & Pick<DebriefPreparationInput, "goal"> = typeof input === "string" ? { goal: input } : input;
    if (!preparation.goal.trim()) throw new Error("Debrief goal must not be empty");
    const sessionId = this.id();
    const instruction = await this.instructions.resolve({ kitId: this.kitId, context: { name: "prebrief" } }, this.pluginContext(sessionId));
    const schedule = hasSchedule(preparation)
      ? normalizeDebriefSchedule({
        callback_at: preparation.callbackAt!,
        callback_timezone: preparation.callbackTimezone!,
        buffer_minutes: preparation.bufferMinutes,
      }, new Date(this.now()))
      : undefined;
    const customer = hasCustomerIdentity(preparation)
      ? await this.persistence?.upsertCustomer(this.context.orgId, preparation, { sessionId, traceId: sessionId })
      : undefined;
    const priorEvents = customer
      ? await this.listCustomerEvents(customer.customerId)
      : [];
    const memoryContext = this.memoryContext(sessionId, customer?.customerId ?? null);
    const memories = await this.memory.readRelevant({
      orgId: this.context.orgId,
      kitId: this.kitId,
      ...(customer ? { customerId: customer.customerId, context: { customer_id: customer.customerId } } : {}),
      limit: 20,
    }, memoryContext);
    const timestamp = this.now();
    const session: DebriefSession = {
      sessionId,
      orgId: this.context.orgId,
      kitId: this.kitId,
      state: "prepared",
      goal: preparation.goal.trim(),
      customerId: customer?.customerId ?? null,
      callbackAt: schedule?.prebrief_ends_at ?? preparation.callbackAt ?? null,
      scheduledCallAt: schedule?.scheduled_call_at ?? preparation.scheduledCallAt ?? null,
      callbackTimezone: schedule?.callback_timezone ?? preparation.callbackTimezone ?? null,
      callId: null,
      instructionVersion: instruction.version,
      memoryIds: memories.map((m) => m.memoryId),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.sessions.set(sessionId, session);
    await this.persist(session);
    if (customer) {
      await this.appendCustomerEvent(session, "prebrief", {
        goal: session.goal,
        company: customer.company,
        contact_name: customer.contactName,
        location: customer.location,
        ...(schedule ? { prebrief_ends_at: schedule.prebrief_ends_at, scheduled_call_at: schedule.scheduled_call_at } : {}),
      });
    }
    if (!schedule || !customer) {
      await this.emit(session, "prepare", "success");
      return this.getSession(sessionId);
    }

    const sections = buildPrebriefSections(customer, priorEvents, memories, session.goal);
    let generatedText = "";
    if (this.infer) {
      try {
        generatedText = (await this.infer({
          goal: session.goal,
          instruction,
          memories,
          customer,
          events: priorEvents,
          sections,
          sessionId,
        })).trim();
      } catch {
        // The deterministic sections remain useful when an optional model
        // provider is unavailable; provider telemetry records the failure.
      }
    }
    const prebrief = generatedText && generatedText !== "Demo extraction complete."
      ? generatedText
      : renderPrebrief(sections);
    await this.emit(session, "prebrief", "success", memories.map((memory) => memory.memoryId));
    return {
      ...this.getSession(sessionId),
      session_id: session.sessionId,
      customer_id: customer.customerId,
      prebrief,
      prebrief_sections: sections,
      prebrief_ends_at: schedule.prebrief_ends_at,
      scheduled_call_at: schedule.scheduled_call_at,
      destination_masked: this.context.destinationMasked ?? "configured demo destination",
      kit_view: { kit_id: "debrief", view: "prebrief", reason: "Review customer context before the scheduled call" },
    };
  }

  async markCalling(sessionId: string): Promise<DebriefSession> { return this.transition(sessionId, "calling"); }
  async awaitConfirmation(sessionId: string): Promise<DebriefSession> { return this.transition(sessionId, "awaiting_confirmation"); }
  async markPartial(sessionId: string): Promise<DebriefSession> { return this.transition(sessionId, "partial"); }
  async confirmDebrief(sessionId: string): Promise<DebriefSession> { return this.transition(sessionId, "confirmed"); }
  async markFailed(sessionId: string, error: unknown): Promise<DebriefSession> {
    const session = this.require(sessionId);
    session.state = "failed";
    session.error = error instanceof Error ? error.message : String(error);
    session.updatedAt = this.now();
    await this.persist(session);
    await this.emit(session, "provider_error", "error");
    return this.getSession(sessionId);
  }

  async teachFromCorrection(sessionId: string, correction: string): Promise<MemoryRecord> {
    const session = this.require(sessionId);
    if (session.state !== "awaiting_confirmation" && session.state !== "partial") throw new Error("Teaching requires an awaiting or partial debrief");
    const record = await this.memory.writeCandidate({
      correction,
      skill: "debrief",
      context: { goal: session.goal, ...(session.customerId ? { customer_id: session.customerId } : {}) },
    }, this.memoryContext(sessionId, session.customerId));
    session.memoryIds.push(record.memoryId);
    session.state = "partial";
    session.updatedAt = this.now();
    await this.persist(session);
    await this.appendCustomerEvent(session, "note", { correction });
    await this.emit(session, "teach", "partial");
    return record;
  }

  /** Approve a candidate that belongs to this debrief's taught/retrieved context. */
  async approveMemory(input: ApproveMemoryInput): Promise<MemoryRecord> {
    const session = this.requireTaughtMemory(input);
    return this.memory.approveCandidate(input.memoryId, this.memoryContext(session.sessionId, session.customerId));
  }

  /** Publish an approved memory that belongs to this debrief's taught/retrieved context. */
  async publishMemory(input: PublishMemoryInput): Promise<MemoryRecord> {
    const session = this.requireTaughtMemory(input);
    return this.memory.publishCandidate(input.memoryId, this.memoryContext(session.sessionId, session.customerId));
  }

  /** Backwards-compatible positional form used by the existing local composition. */
  async approve(sessionId: string, memoryId: string): Promise<MemoryRecord> {
    return this.approveMemory({ sessionId, memoryId });
  }

  /** Backwards-compatible positional form used by the existing local composition. */
  async publish(sessionId: string, memoryId: string): Promise<MemoryRecord> {
    return this.publishMemory({ sessionId, memoryId });
  }

  getSession(sessionId: string): DebriefSession { const session = this.require(sessionId); return { ...session, memoryIds: [...session.memoryIds] }; }
  getDebrief(sessionId: string): DebriefSummary { const s = this.getSession(sessionId); return { sessionId: s.sessionId, state: s.state, goal: s.goal, instructionVersion: s.instructionVersion, memoryIds: s.memoryIds }; }
  clearSessions(): void { this.sessions.clear(); }

  async getCustomer(customerId: string): Promise<CustomerRecord | null> {
    return this.persistence?.getCustomer(this.context.orgId, customerId) ?? null;
  }

  async listCustomerEvents(customerId: string): Promise<CustomerEventRecord[]> {
    return this.persistence?.listCustomerEvents(this.context.orgId, customerId, this.kitId) ?? [];
  }

  async getDraft(sessionId: string): Promise<DebriefDraftRecord | null> {
    this.require(sessionId);
    return this.persistence?.getDraft(this.context.orgId, sessionId) ?? null;
  }

  async saveDraft(
    sessionId: string,
    fields: Record<string, unknown>,
    status: DebriefDraftStatus = "draft",
  ): Promise<DebriefDraftRecord> {
    const session = this.require(sessionId);
    if (!this.persistence) throw new Error("Debrief persistence is not configured");
    const existing = await this.persistence.getDraft(this.context.orgId, sessionId);
    const draft: DebriefDraftRecord = {
      draftId: existing?.draftId ?? `draft-${this.id()}`,
      orgId: session.orgId,
      customerId: session.customerId,
      sessionId,
      kitId: session.kitId,
      status,
      fields: { ...(existing?.fields ?? {}), ...fields },
      updatedAt: this.now(),
    };
    await this.persistDraft(draft);
    return { ...draft, fields: { ...draft.fields } };
  }

  async setCallId(sessionId: string, callId: string): Promise<DebriefSession> {
    const session = this.require(sessionId);
    session.callId = callId;
    session.updatedAt = this.now();
    await this.persist(session);
    return this.getSession(sessionId);
  }

  private get kitId(): string { return this.context.kitId ?? "kit:debrief"; }
  private require(id: string): DebriefSession { const session = this.sessions.get(id); if (!session) throw new Error(`Debrief session "${id}" was not found`); return session; }
  private requireTaughtMemory(input: TaughtMemoryOperationInput): DebriefSession {
    const session = this.require(input.sessionId);
    if (!session.memoryIds.includes(input.memoryId)) {
      throw new Error(`Memory "${input.memoryId}" is not part of debrief session "${input.sessionId}"`);
    }
    return session;
  }
  private memoryContext(sessionId: string, customerId: string | null = null) { return { orgId: this.context.orgId, appId: this.context.appId, sessionId, traceId: sessionId, parentId: null, kitId: this.kitId, customerId }; }
  private pluginContext(sessionId: string) { return { ...this.memoryContext(sessionId), telemetry: this.telemetry, lookupPlugin: () => undefined }; }
  private async transition(id: string, state: DebriefState): Promise<DebriefSession> { const s = this.require(id); const allowed = s.state === "prepared" && state === "calling" || s.state === "calling" && state === "awaiting_confirmation" || s.state === "awaiting_confirmation" && state === "partial" || (s.state === "awaiting_confirmation" || s.state === "partial") && state === "confirmed"; if (!allowed) throw new Error(`Invalid debrief transition ${s.state} -> ${state}`); s.state = state; s.updatedAt = this.now(); await this.persist(s); if (state === "confirmed") await this.appendCustomerEvent(s, "debrief_confirmed", { outcome: "confirmed" }); const operation = state === "confirmed" ? "complete" : state === "awaiting_confirmation" ? "await_confirmation" : "state"; await this.emit(s, operation, state === "partial" ? "partial" : "success"); return this.getSession(id); }
  private async persist(session: DebriefSession): Promise<void> { await this.persistence?.saveSession(cloneSession(session)); }
  private async persistDraft(draft: DebriefDraftRecord): Promise<void> { await this.persistence?.saveDraft(draft); }
  private async appendCustomerEvent(session: DebriefSession, type: CustomerEventRecord["type"], payload: Record<string, unknown>): Promise<void> { if (!session.customerId || !this.persistence) return; await this.persistence.appendCustomerEvent({ eventId: `event-${this.id()}`, orgId: session.orgId, customerId: session.customerId, sessionId: session.sessionId, kitId: session.kitId, type, occurredAt: this.now(), payload }); }
  private async emit(s: DebriefSession, operation: string, outcome: "success" | "partial" | "error", memoryIds?: string[]) { const event: TelemetryEventInput = { id: this.id(), timestamp: this.now(), orgId: s.orgId, appId: this.context.appId, sessionId: s.sessionId, customerId: s.customerId, traceId: s.sessionId, channel: "voice", pluginId: "kit:debrief", kitId: s.kitId, type: operation === "complete" ? "session.completed" : "voice.call", operation, outcome, ...(memoryIds?.length ? { memoryIds } : {}) }; await this.telemetry.append(event); }
}

function hasCustomerIdentity(input: Partial<DebriefPreparationInput>): input is DebriefPreparationInput {
  return Boolean(input.company?.trim() && input.contactName?.trim() && input.location?.trim());
}

function hasSchedule(input: Partial<DebriefPreparationInput>): input is DebriefPreparationInput & Required<Pick<DebriefPreparationInput, "callbackAt" | "callbackTimezone">> {
  return Boolean(input.callbackAt?.trim() || input.callbackTimezone?.trim());
}

function buildPrebriefSections(
  customer: CustomerRecord,
  events: readonly CustomerEventRecord[],
  memories: readonly MemoryRecord[],
  goal: string,
): PrebriefSections {
  const known = [
    `Company: ${customer.company}`,
    `Contact: ${customer.contactName}`,
    `Location: ${customer.location}`,
  ];
  const lastEvent = [...events].reverse().find((event) => event.type !== "prebrief");
  const last_interaction = lastEvent ? summarizeEvent(lastEvent) : "No prior interaction recorded.";
  const open_items = memories.length
    ? memories.slice(0, 3).map((memory) => `Approved memory: ${memory.correction}`)
    : ["No open items recorded."];
  return { known, last_interaction, open_items, call_objective: goal };
}

function summarizeEvent(event: CustomerEventRecord): string {
  if (event.type === "debrief_confirmed") return "Previous debrief was confirmed.";
  if (event.type === "address_discovered") return "Previous call captured a new address.";
  if (event.type === "note") return "Previous debrief included an operator note.";
  if (event.type === "call_completed") return "Previous voice call completed.";
  return "Previous customer interaction recorded.";
}

function renderPrebrief(sections: PrebriefSections): string {
  return [
    `Known: ${sections.known.join("; ")}`,
    `Last interaction: ${sections.last_interaction}`,
    `Open items: ${sections.open_items.join("; ")}`,
    `Call objective: ${sections.call_objective}`,
  ].join("\n");
}

function cloneSession(session: DebriefSession): DebriefSession {
  return { ...session, memoryIds: [...session.memoryIds] };
}
