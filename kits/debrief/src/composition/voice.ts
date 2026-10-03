import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { KitDefinition, KitToolExecutor, TelemetryEventInput as SdkTelemetryEventInput } from "@kitstackco/sdk";
import { createVoiceChannel, type OpenAIRealtimeSocketFactory, type VoiceCall, type VoiceChannel } from "@kitstackco/voice";
import { createDebriefVoiceTools } from "../adapters/voice/tools.js";
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
  "KITSTACK_DEMO_ALLOWED_DESTINATION",
] as const;

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
): Promise<VoiceChannel | undefined> {
  const value = (name: string) => env[name]?.trim() ?? "";
  const phoneConfigured = PHONE_ENV.some((name) => value(name));
  if (phoneConfigured) {
    const missing = [...PHONE_ENV, "OPENAI_API_KEY"].filter((name) => !value(name));
    if (missing.length) throw new Error(`Live voice configuration is incomplete; missing ${missing.join(", ")}`);
  }
  const apiKey = value("OPENAI_API_KEY");
  if (!apiKey) return undefined;

  const baseInstructions = readFileSync(new URL("../instructions/debrief-baseline.md", import.meta.url), "utf8");
  const baseVersion = `sha256:${createHash("sha256").update(baseInstructions, "utf8").digest("hex")}`;
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
      routingReason: route.reason,
      ...(providers.openaiSocketFactory ? { socketFactory: providers.openaiSocketFactory } : {}),
    },
    ...(phoneConfigured ? {
      phone: {
        accountSid: value("TWILIO_ACCOUNT_SID"),
        authToken: value("TWILIO_AUTH_TOKEN"),
        fromNumber: value("TWILIO_FROM_NUMBER"),
        publicUrl: value("KITSTACK_DEMO_PUBLIC_HTTPS_URL"),
        allowedDestinations: [value("KITSTACK_DEMO_ALLOWED_DESTINATION")],
        // Real phone calls always need the operator token, even in loopback auth-none mode.
        authorizeStart: (request) => Boolean(app.adminToken) && request.headers["x-demo-admin-token"] === app.adminToken,
        ...(providers.twilioFetch ? { fetch: providers.twilioFetch } : {}),
      },
    } : {}),
    localHarness: true,
    bargeInMs: optionalNumber(value("KITSTACK_VOICE_BARGE_IN_MS")),
    tools: createDebriefVoiceTools(kit, executor),
    briefing: (call) => debriefBriefing(app, call, baseInstructions, baseVersion),
    sessions: {
      async startSession(sessionId, channel) {
        const session = app.debrief.getSession(sessionId);
        if (channel === "local" && session.state !== "prepared") throw new Error(`Local voice session must be prepared, received ${session.state}`);
        await app.debrief.markCalling(sessionId);
        return { orgId: session.orgId, appId: app.appId };
      },
      onCallStarted: async (sessionId, callId) => { await app.debrief.setCallId(sessionId, callId); },
      onStartFailed: async (sessionId, error) => { await app.debrief.markFailed(sessionId, error); },
      onAgentFinished: async (sessionId) => { await app.debrief.awaitConfirmation(sessionId); },
      onCallInterrupted: async (sessionId, reason) => { await app.debrief.endCallAfterInterruption(sessionId, reason); },
      onCallCompleted: async (call) => {
        const session = app.debrief.getSession(call.sessionId);
        await app.debrief.recordCallCompleted(call);
        await app.telemetry.append({
          id: crypto.randomUUID(), timestamp: call.occurredAt, orgId: call.orgId, appId: app.appId,
          customerId: session.customerId, sessionId: call.sessionId, traceId: call.sessionId,
          channel: "voice", pluginId: "kit:debrief", kitId: session.kitId, type: "voice.call",
          operation: "call_completed", provider: call.provider, callId: call.callId, outcome: "success",
        });
      },
      resolveSessionIdForCallId: async (callId) => {
        const job = (await app.scheduler.list(app.orgId)).find((candidate) => candidate.providerCallId === callId);
        return job?.sessionId ?? null;
      },
    },
  });
}

/** The debrief agent's per-call instructions: goal, customer, history and approved feedback. */
async function debriefBriefing(app: DemoApp, call: VoiceCall, baseInstructions: string, baseVersion: string) {
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
  const content = [
    baseInstructions.trim(),
    "\nPrepared debrief context:",
    `Goal: ${session.goal}`,
    customer ? `Customer: ${customer.company}; contact ${customer.contactName}; location ${customer.location}` : "Customer: unavailable.",
    history.length
      ? `Previous confirmed debriefs with this customer (newest first). Refer to them and ask how the agreed next steps went:\n${history.map((entry) => `- ${entry}`).join("\n")}`
      : "Previous confirmed debriefs with this customer: none.",
    selected.length ? `Approved workflow feedback:\n${selected.map((record) => `- ${record.correction}`).join("\n")}` : "Approved workflow feedback: none.",
    "Use this context during the call. Ask one useful question at a time and do not invent customer details.",
    "When the caller explicitly states or agrees an outcome, next step, customer update, address, or follow-up date, call update_debrief_draft with those facts. Never call a confirmation or publish action; the operator confirms the draft after the call.",
    "When the debrief goals are covered, briefly summarise the saved facts, say goodbye, then call end_call. Also call end_call if the caller asks to end the call.",
  ].join("\n");
  return {
    content,
    version: `${baseVersion}:${call.channel}:${createHash("sha256").update(content, "utf8").digest("hex").slice(0, 16)}`,
    memoryIds: selected.map((record) => record.memoryId),
  };
}

function optionalNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
