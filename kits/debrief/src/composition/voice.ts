import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { KitDefinition, KitToolExecutor, TelemetryEventInput as SdkTelemetryEventInput } from "@kitstackco/sdk";
import { createVoiceChannel, type OpenAIRealtimeSocketFactory, type VoiceCall, type VoiceChannel } from "@kitstackco/voice";
import type { CrmClient } from "@kitstackco/crm";
import { createDebriefVoiceTools } from "../adapters/voice/tools.js";
import { crmAccountFor, crmBriefingLines } from "./crm.js";
import type { TelemetryEventInput } from "../telemetry/index.js";
import type { DemoApp } from "./app/index.js";

/** Test seams for the provider network calls; production uses the real APIs. */
export interface VoiceProviderOverrides {
  openaiSocketFactory?: OpenAIRealtimeSocketFactory;
  twilioFetch?: typeof fetch;
}

const PHONE_ENV = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "KITSTACK_DEMO_PUBLIC_HTTPS_URL",
] as const;

/** Countries the self-service callback number may belong to: DE, AT, CH. */
const ALLOWED_DESTINATION_COUNTRY_CODES = ["+49", "+43", "+41"] as const;

/**
 * The debrief's voice channel: phone calls when Twilio is configured, and the
 * local browser harness whenever OpenAI is. The kit supplies only its
 * briefing, its tools and its session state machine.
 */
export async function createDebriefVoiceChannel(
  app: DemoApp,
  kit: KitDefinition,
  executor: KitToolExecutor,
  providers: VoiceProviderOverrides = {},
  env: NodeJS.ProcessEnv = process.env,
  crm?: CrmClient,
): Promise<VoiceChannel | undefined> {
  const value = (name: string) => env[name]?.trim() ?? "";
  const phoneConfigured = PHONE_ENV.some((name) => value(name));
  if (phoneConfigured) {
    const missing = [...PHONE_ENV, "OPENAI_API_KEY"].filter((name) => !value(name));
    if (missing.length) throw new Error(`Live voice configuration is incomplete; missing ${missing.join(", ")}`);
  }
  const apiKey = value("OPENAI_API_KEY");
  if (!apiKey) return undefined;
  const workspaceOf = (sessionId: string) => app.tenants.forSession(sessionId);

  const baseInstructions = readFileSync(new URL("../instructions/debrief-baseline.md", import.meta.url), "utf8");
  const baseVersion = `sha256:${createHash("sha256").update(baseInstructions, "utf8").digest("hex")}`;
  const prebriefCallInstructions = readFileSync(new URL("../instructions/prebrief-call-baseline.md", import.meta.url), "utf8");
  const prebriefCallVersion = `sha256:${createHash("sha256").update(prebriefCallInstructions, "utf8").digest("hex")}`;
  const voiceTools = createDebriefVoiceTools(kit, executor);
  const route = await app.modelRouter.resolve("conversation", { orgId: app.orgId, appId: app.appId, kitId: "kit:debrief", pluginId: "channel:voice" });

  return createVoiceChannel({
    kitId: "kit:debrief",
    agentId: "debrief-voice-interviewer",
    orgId: app.orgId,
    telemetry: { append: (event: SdkTelemetryEventInput) => app.telemetry.append(event as TelemetryEventInput) },
    sessionSecret: app.apps.secret,
    realtime: {
      apiKey,
      model: value("OPENAI_REALTIME_MODEL") || "gpt-realtime",
      voice: value("OPENAI_REALTIME_VOICE") || "marin",
      ...(value("OPENAI_REALTIME_URL") ? { url: value("OPENAI_REALTIME_URL") } : {}),
      ...(optionalNumber(value("OPENAI_REALTIME_VAD_THRESHOLD")) !== undefined ? { vadThreshold: optionalNumber(value("OPENAI_REALTIME_VAD_THRESHOLD")) } : {}),
      ...(optionalNumber(value("OPENAI_REALTIME_SILENCE_MS")) !== undefined ? { silenceDurationMs: optionalNumber(value("OPENAI_REALTIME_SILENCE_MS")) } : {}),
      ...(optionalNumber(value("OPENAI_REALTIME_PREFIX_PADDING_MS")) !== undefined ? { prefixPaddingMs: optionalNumber(value("OPENAI_REALTIME_PREFIX_PADDING_MS")) } : {}),
      routingReason: route.reason,
      ...(providers.openaiSocketFactory ? { socketFactory: providers.openaiSocketFactory } : {}),
    },
    ...(phoneConfigured ? {
      phone: {
        accountSid: value("TWILIO_ACCOUNT_SID"),
        authToken: value("TWILIO_AUTH_TOKEN"),
        fromNumber: value("TWILIO_FROM_NUMBER"),
        publicUrl: value("KITSTACK_DEMO_PUBLIC_HTTPS_URL"),
        // The session owner's verified number, preferred over the legacy
        // single-destination allowlist below.
        resolveDestination: async (sessionId: string) => resolveScheduledCallDestination(await workspaceOf(sessionId), sessionId, env),
        ...(value("KITSTACK_DEMO_ALLOWED_DESTINATION") ? { allowedDestinations: [value("KITSTACK_DEMO_ALLOWED_DESTINATION")] } : {}),
        // Real phone calls always need the operator token, even in loopback auth-none mode.
        authorizeStart: (request) => Boolean(app.adminToken) && request.headers["x-demo-admin-token"] === app.adminToken,
        ...(providers.twilioFetch ? { fetch: providers.twilioFetch } : {}),
      },
    } : {}),
    localHarness: true,
    bargeInMs: optionalNumber(value("KITSTACK_VOICE_BARGE_IN_MS")),
    tools: (call) => voiceTools.forPurpose(call.purpose),
    // One channel serves every organization: each callback resolves the
    // workspace that owns the call's session.
    briefing: async (call) => {
      const workspace = await workspaceOf(call.sessionId);
      const crmForWorkspace = workspace.orgId === app.tenants.operatorOrgId ? crm : undefined;
      return call.purpose === "prebrief"
        ? prebriefCallBriefing(workspace, call, prebriefCallInstructions, prebriefCallVersion, crmForWorkspace)
        : debriefBriefing(workspace, call, baseInstructions, baseVersion, crmForWorkspace);
    },
    sessions: {
      async startSession(sessionId, channel, purpose) {
        const workspace = await workspaceOf(sessionId);
        const session = workspace.debrief.getSession(sessionId);
        if (channel === "local" && session.state !== "prepared") throw new Error(`Local voice session must be prepared, received ${session.state}`);
        // A prebrief call never moves the session out of "prepared": the
        // later debrief call must find it exactly as it was scheduled.
        if (purpose !== "prebrief") await workspace.debrief.markCalling(sessionId);
        return { orgId: session.orgId, appId: workspace.appId };
      },
      onCallStarted: async (sessionId, callId) => { await (await workspaceOf(sessionId)).debrief.setCallId(sessionId, callId); },
      onStartFailed: async (sessionId, error, purpose) => {
        const workspace = await workspaceOf(sessionId);
        if (purpose === "prebrief") {
          await emitPrebriefTelemetry(workspace, sessionId, "prebrief.start_failed", "error");
          return;
        }
        await workspace.debrief.markFailed(sessionId, error);
      },
      onAgentFinished: async (sessionId, purpose) => {
        if (purpose === "prebrief") return;
        await (await workspaceOf(sessionId)).debrief.awaitConfirmation(sessionId);
      },
      onCallInterrupted: async (sessionId, reason) => { await (await workspaceOf(sessionId)).debrief.endCallAfterInterruption(sessionId, reason); },
      onCallCompleted: async (call) => {
        const workspace = await workspaceOf(call.sessionId);
        if (call.purpose === "prebrief") {
          await emitPrebriefTelemetry(workspace, call.sessionId, "prebrief.call_completed", "success", call.provider, call.callId);
          return;
        }
        const session = workspace.debrief.getSession(call.sessionId);
        await workspace.debrief.recordCallCompleted(call);
        await workspace.telemetry.append({
          id: crypto.randomUUID(), timestamp: call.occurredAt, orgId: call.orgId, appId: workspace.appId,
          customerId: session.customerId, sessionId: call.sessionId, traceId: call.sessionId,
          channel: "voice", pluginId: "kit:debrief", kitId: session.kitId, type: "voice.call",
          operation: "call_completed", provider: call.provider, callId: call.callId, outcome: "success",
        });
      },
      resolveSessionIdForCallId: (callId) => app.tenants.sessionIdForProviderCall(callId),
    },
  });
}

/** Metadata-only telemetry for a prebrief call outcome; never changes session state. */
async function emitPrebriefTelemetry(
  workspace: DemoApp,
  sessionId: string,
  operation: string,
  outcome: "success" | "error",
  provider?: string,
  callId?: string | null,
): Promise<void> {
  const session = workspace.debrief.getSession(sessionId);
  await workspace.telemetry.append({
    id: crypto.randomUUID(), timestamp: new Date().toISOString(), orgId: session.orgId, appId: workspace.appId,
    customerId: session.customerId, sessionId, traceId: sessionId,
    channel: "voice", pluginId: "kit:debrief", kitId: session.kitId, type: "voice.call",
    operation, outcome, ...(provider ? { provider } : {}), ...(callId ? { callId } : {}),
  });
}

/** Shared retrieval for both the debrief and prebrief call briefings. */
async function briefingContext(app: DemoApp, call: VoiceCall, crm?: CrmClient) {
  const session = app.debrief.getSession(call.sessionId);
  const customer = session.customerId ? await app.debrief.getCustomer(session.customerId) : null;
  const history = session.customerId ? await app.debrief.recentDebriefSummaries(session.customerId) : [];
  const records = await app.memory.readRelevant({
    orgId: session.orgId,
    kitId: session.kitId,
    ...(session.customerId ? { customerId: session.customerId } : {}),
    limit: 20,
  }, {
    orgId: session.orgId,
    appId: call.appId,
    sessionId: session.sessionId,
    traceId: session.sessionId,
    parentId: null,
    kitId: session.kitId,
    customerId: session.customerId,
  });
  const selected = records.filter((record) => session.memoryIds.includes(record.memoryId));
  const crmLines = crmBriefingLines(await crmAccountFor(app, crm, session.sessionId));
  return { session, customer, history, selected, crmLines };
}

/** The debrief agent's per-call instructions: goal, customer, history and approved feedback. */
async function debriefBriefing(app: DemoApp, call: VoiceCall, baseInstructions: string, baseVersion: string, crm?: CrmClient) {
  const { session, customer, history, selected, crmLines } = await briefingContext(app, call, crm);
  const meetingPlan = await app.debrief.getMeetingPlan(session.sessionId);
  const content = [
    baseInstructions.trim(),
    "\nPrepared debrief context:",
    `Goal: ${session.goal}`,
    customer ? `Customer: ${customer.company}; contact ${customer.contactName}; location ${customer.location}` : "Customer: unavailable.",
    ...(meetingPlan ? [`The rep planned before this meeting: ${meetingPlan}\nAsk how it went against that plan.`] : []),
    ...(crmLines.length ? [`CRM context (read-only; do not read it out verbatim):\n${crmLines.map((line) => `- ${line}`).join("\n")}`] : []),
    history.length
      ? `Previous confirmed debriefs with this customer (newest first). Refer to them and ask how the agreed next steps went:\n${history.map((entry) => `- ${entry}`).join("\n")}`
      : "Previous confirmed debriefs with this customer: none.",
    selected.length ? `Approved workflow feedback:\n${selected.map((record) => `- ${record.correction}`).join("\n")}` : "Approved workflow feedback: none.",
    "Use this context during the call. Ask one useful question at a time and do not invent customer details.",
    "When the caller explicitly states or agrees an outcome, next step, customer update, address, or follow-up date, call update_debrief_draft with those facts. Never call a confirmation or publish action; the operator confirms the draft after the call.",
    "When the debrief goals are covered, briefly summarise the saved facts. Then tell the caller that nothing is saved yet: they should open Claude and ask it to show the debrief for confirmation, check or correct the fields there, and confirm it. Say goodbye, then call end_call. Also call end_call if the caller asks to end the call, after the same one-sentence reminder to confirm in Claude.",
  ].join("\n");
  return {
    content,
    version: `${baseVersion}:${call.channel}:${createHash("sha256").update(content, "utf8").digest("hex").slice(0, 16)}`,
    memoryIds: selected.map((record) => record.memoryId),
  };
}

/**
 * The prebrief agent's per-call instructions: a short spoken summary of the
 * customer, then collect the rep's plan for the meeting. It never mentions
 * the debrief draft or confirmation, and saves only the meeting plan.
 */
async function prebriefCallBriefing(app: DemoApp, call: VoiceCall, baseInstructions: string, baseVersion: string, crm?: CrmClient) {
  const { session, customer, history, selected, crmLines } = await briefingContext(app, call, crm);
  const content = [
    baseInstructions.trim(),
    "\nUpcoming sales meeting:",
    `Goal: ${session.goal}`,
    customer ? `Customer: ${customer.company}; contact ${customer.contactName}; location ${customer.location}` : "Customer: unavailable.",
    ...(crmLines.length ? [`CRM context (read-only; do not read it out verbatim):\n${crmLines.map((line) => `- ${line}`).join("\n")}`] : []),
    history.length
      ? `Previous confirmed debriefs with this customer (newest first):\n${history.map((entry) => `- ${entry}`).join("\n")}`
      : "Previous confirmed debriefs with this customer: none.",
    selected.length ? `Approved workflow feedback:\n${selected.map((record) => `- ${record.correction}`).join("\n")}` : "Approved workflow feedback: none.",
    "Greet the rep, give a short spoken summary of the above, then ask what they want to achieve on this call and any concerns. When they answer, call save_meeting_plan with that as the plan. Do not mention or call update_debrief_draft, and do not ask for any confirmation in Claude on this call.",
    "Once the plan is saved, wish the rep luck, say goodbye, then call end_call.",
  ].join("\n");
  return {
    content,
    version: `${baseVersion}:${call.channel}:prebrief:${createHash("sha256").update(content, "utf8").digest("hex").slice(0, 16)}`,
    memoryIds: selected.map((record) => record.memoryId),
  };
}

/**
 * Resolve a scheduled call's destination from the session owner's verified
 * number, re-checking the country allowlist (defence in depth: register_phone
 * already enforces it, but a destination is never dialed on trust alone).
 * Falls back to the operator demo's single configured destination only for
 * the operator org, so today's demo keeps working while numbers roll out.
 */
async function resolveScheduledCallDestination(
  app: DemoApp,
  sessionId: string,
  env: NodeJS.ProcessEnv,
): Promise<string | null> {
  const session = app.debrief.getSession(sessionId);
  let destination: string | null = session.ownerId
    ? await app.phone.getVerifiedNumber(session.orgId, session.ownerId)
    : null;
  if (!destination) {
    const operatorOrgId = env.KITSTACK_DEMO_ORG_ID?.trim() || "org-demo";
    const fallback = env.KITSTACK_DEMO_ALLOWED_DESTINATION?.trim();
    if (fallback && session.orgId === operatorOrgId) destination = fallback;
  }
  if (destination && !ALLOWED_DESTINATION_COUNTRY_CODES.some((code) => destination!.startsWith(code))) return null;
  return destination;
}

function optionalNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
