import { createClient, type Client } from "@libsql/client";
import { createAppRegistry, type AppRegistry } from "../../adapters/auth/index.js";
import type { McpAuthMode } from "../../adapters/auth/mcp.js";
import { DebriefService, type DebriefSession, type MemoryStoreLike, type TextInference } from "../../functions/index.js";
import { createDebriefPersistence, type DebriefPersistence } from "../../functions/persistence.js";
import { createInstructionPlugin, type InstructionPlugin } from "../../instructions/plugin.js";
import { createMemoryStore, type MemoryContext, type MemoryReadQuery, type MemoryStore, type MemoryWriteInput } from "../../memory/plugin.js";
import { createDemoPluginRegistry, type DemoPluginContext, type PluginContextInput, type PluginRegistry } from "../../plugins/registry/index.js";
import { handleProxyRequest } from "../../adapters/proxy/index.js";
import type { ClaimDueInput, CompleteCallInput, FailCallInput, ScheduleCallInput, ScheduledCallOperations } from "../../scheduler/index.js";
import { createScheduledCallStore } from "../../scheduler/index.js";
import { createTelemetryStore, type TelemetryStore } from "../../telemetry/index.js";
import { VoiceSimulator } from "../../adapters/voice/index.js";
import { createLibsqlStorageAdapter } from "../../storage/libsql.js";

export interface DemoApp {
  readonly client: Client;
  readonly orgId: string;
  readonly appId: string | null;
  readonly telemetry: TelemetryStore;
  readonly apps: AppRegistry;
  readonly memory: MemoryStore;
  readonly instructions: InstructionPlugin;
  readonly debrief: DebriefService;
  readonly voice: VoiceSimulator;
  /** Registry-backed scheduled-call operations. The provider seam is owned by the poller. */
  readonly scheduler: ScheduledCallOperations;
  readonly plugins: PluginRegistry;
  readonly mcpAuthMode: McpAuthMode;
  readonly adminToken: string;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export interface CreateDemoAppOptions {
  url?: string;
  /** Optional libSQL/Turso auth token for a remote demo database. */
  authToken?: string;
  orgId?: string;
  appId?: string | null;
  secret?: string;
  /** Explicit MCP auth mode. Defaults to none for loopback-only development. */
  mcpAuthMode?: McpAuthMode;
  /** Separate operator token required to register/issue apps in app-token mode. */
  adminToken?: string;
}

export async function createDemoApp(options: CreateDemoAppOptions = {}): Promise<DemoApp> {
  const orgId = options.orgId ?? "org-demo";
  const appId = options.appId ?? null;
  const mcpAuthMode = options.mcpAuthMode ?? "none";
  const adminToken = options.adminToken ?? "demo-admin-token";
  if (!adminToken.trim()) throw new Error("adminToken must not be empty");
  const client = createClient({
    url: options.url ?? ":memory:",
    ...(options.authToken ? { authToken: options.authToken } : {}),
  });
  const telemetry = await createTelemetryStore({ client });
  const storage = createLibsqlStorageAdapter(client, { scope: { orgId, kitId: "kit:debrief" } });
  const apps = createAppRegistry({ secret: options.secret ?? "demo-secret-at-least-32-characters-long" });
  const memory = createMemoryStore(client, telemetry);
  const debriefStore = createDebriefPersistence(client, { storage });
  const scheduledCallStore = createScheduledCallStore(client);
  const initialSessions = await debriefStore.loadSessions(orgId, "kit:debrief");
  const instructions = createInstructionPlugin({ kitId: "kit:debrief", context: "prebrief" });
  let plugins!: PluginRegistry;
  let debrief!: DebriefService;
  let voice!: VoiceSimulator;

  const dispatchContext = (context: MemoryContext): PluginContextInput => ({
    orgId: context.orgId,
    appId: context.appId,
    sessionId: context.sessionId,
    traceId: context.traceId,
    parentId: context.parentId,
    telemetry,
  });

  const memoryBoundary: MemoryStoreLike = {
    writeCandidate: (input, context) => plugins.dispatch("memory:default", { operation: "write_candidate", input, context }, dispatchContext(context)),
    approveCandidate: (memoryId, context) => plugins.dispatch("memory:default", { operation: "approve", memoryId, context }, dispatchContext(context)),
    publishCandidate: (memoryId, context) => plugins.dispatch("memory:default", { operation: "publish", memoryId, context }, dispatchContext(context)),
    readRelevant: (query, context) => plugins.dispatch("memory:default", { operation: "read_relevant", query, context }, dispatchContext(context)),
  };

  const instructionBoundary: InstructionPlugin = {
    ...instructions,
    invoke: (request, context) => plugins.dispatch("instructions:debrief-baseline", { request }, {
      orgId: context.orgId,
      appId: context.appId,
      sessionId: context.sessionId,
      traceId: context.traceId,
      parentId: context.parentId,
      telemetry,
    }),
    resolve: (request, context) => plugins.dispatch("instructions:debrief-baseline", { request }, {
      orgId: context.orgId,
      appId: context.appId,
      sessionId: context.sessionId,
      traceId: context.traceId,
      parentId: context.parentId,
      telemetry,
    }),
  };

  const pluginHandlers = {
    "persistence:libsql": async (input: unknown) => {
      const request = input as { operation?: string; run?: () => Promise<unknown> };
      const operation = request.operation ?? "health";
      await client.execute("SELECT 1");
      return request.run ? request.run() : { operation, backend: "libsql", durable: true };
    },
    "memory:default": async (input: unknown, context: DemoPluginContext) => {
      const request = input as { operation: string; input?: MemoryWriteInput; memoryId?: string; query?: MemoryReadQuery; context: MemoryContext };
      if (request.operation === "write_candidate" && request.input) {
        return plugins.dispatch("persistence:libsql", { operation: "memory.write_candidate", run: () => memory.writeCandidate(request.input!, request.context) }, contextToPluginInput(context, telemetry));
      }
      if (request.operation === "approve" && request.memoryId) {
        return plugins.dispatch("persistence:libsql", { operation: "memory.approve", run: () => memory.approveCandidate(request.memoryId!, request.context) }, contextToPluginInput(context, telemetry));
      }
      if (request.operation === "publish" && request.memoryId) {
        return plugins.dispatch("persistence:libsql", { operation: "memory.publish", run: () => memory.publishCandidate(request.memoryId!, request.context) }, contextToPluginInput(context, telemetry));
      }
      if (request.operation === "read_relevant" && request.query) {
        return plugins.dispatch("persistence:libsql", { operation: "memory.read_relevant", run: () => memory.readRelevant(request.query!, request.context) }, contextToPluginInput(context, telemetry));
      }
      if (request.operation === "reset") {
        return plugins.dispatch("persistence:libsql", { operation: "memory.reset", run: async () => { await memory.reset(request.context); return { ok: true }; } }, contextToPluginInput(context, telemetry));
      }
      throw new Error(`Unknown memory plugin operation: ${request.operation}`);
    },
    "instructions:debrief-baseline": async (input: unknown, context: DemoPluginContext) => {
      const request = (input as { request: Parameters<InstructionPlugin["resolve"]>[0] }).request;
      return instructions.resolve(request, context);
    },
    "kit:debrief": async (input: unknown) => {
      const request = input as {
        operation: string;
        sessionId?: string;
        goal?: string;
        company?: string;
        contactName?: string;
        location?: string;
        callbackAt?: string;
        callbackTimezone?: string;
        bufferMinutes?: number;
        correction?: string;
        outcome?: "confirmed" | "partial";
        memoryId?: string;
      };
      if (request.operation === "prepare") {
        if (request.company && request.contactName && request.location && request.callbackAt && request.callbackTimezone) {
          const prepared = await debrief.prepareDebrief({
            goal: request.goal ?? "",
            company: request.company,
            contactName: request.contactName,
            location: request.location,
            callbackAt: request.callbackAt,
            callbackTimezone: request.callbackTimezone,
            bufferMinutes: request.bufferMinutes,
          });
          if ("scheduled_call_at" in prepared && "session_id" in prepared) {
            await scheduler.schedule({
              orgId,
              sessionId: String(prepared.session_id),
              scheduledAt: String(prepared.scheduled_call_at),
            });
          }
          return prepared;
        }
        return debrief.prepareDebrief(request.goal ?? "");
      }
      if (request.operation === "get_session" && request.sessionId) return debrief.getSession(request.sessionId);
      if (request.operation === "get_debrief" && request.sessionId) return debrief.getDebrief(request.sessionId);
      if (request.operation === "confirm" && request.sessionId) return request.outcome === "partial" ? debrief.markPartial(request.sessionId) : debrief.confirmDebrief(request.sessionId);
      if (request.operation === "teach" && request.sessionId && request.correction) return debrief.teachFromCorrection(request.sessionId, request.correction);
      if (request.operation === "approve" && request.sessionId && request.memoryId) return debrief.approve(request.sessionId, request.memoryId);
      if (request.operation === "publish" && request.sessionId && request.memoryId) return debrief.publish(request.sessionId, request.memoryId);
      throw new Error(`Unknown debrief kit operation: ${request.operation}`);
    },
    "ai:demo-compatible": async (input: unknown) => {
      const request = (input as { request: Request }).request;
      const body = await request.clone().json() as { model?: string };
      return new Response(JSON.stringify({
        id: `demo-${crypto.randomUUID()}`,
        object: "chat.completion",
        model: body.model ?? "gpt-4o-mini",
        choices: [{ index: 0, message: { role: "assistant", content: "Demo extraction complete." }, finish_reason: "stop" }],
        usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
    "http:demo-routes": async (input: unknown) => ({ accepted: true, ...(input as Record<string, unknown>) }),
    "trigger:voice-http": async (input: unknown) => {
      const request = input as { operation: string; sessionId: string };
      if (request.operation === "start") return voice.start(request.sessionId);
      if (request.operation === "complete") return voice.complete(request.sessionId, (input as { outcome: "confirmed" | "partial" }).outcome);
      throw new Error(`Unknown voice trigger operation: ${request.operation}`);
    },
    "channel:voice": async (input: unknown) => {
      const request = input as { operation: string; sessionId: string };
      if (request.operation === "status") return voice.status(request.sessionId);
      if (request.operation === "advance") return voice.advance(request.sessionId);
      throw new Error(`Unknown voice channel operation: ${request.operation}`);
    },
    "proxy:demo-openai-compatible": async (input: unknown, context: DemoPluginContext) => {
      const request = (input as { request: Request }).request;
      return handleProxyRequest(request, {
        registry: apps,
        telemetry,
        upstream: (upstreamRequest) => plugins.dispatch("ai:demo-compatible", { request: upstreamRequest }, contextToPluginInput(context, telemetry)),
      });
    },
    "scheduler:scheduled-calls": async (input: unknown, context: DemoPluginContext) => {
      const request = input as {
        operation: "schedule" | "claim_due" | "complete" | "fail" | "reset";
        input?: ScheduleCallInput | ClaimDueInput | CompleteCallInput | FailCallInput | { orgId: string };
      };
      const persist = <T>(operation: string, run: () => Promise<T>) => plugins.dispatch("persistence:libsql", {
        operation,
        run,
      }, contextToPluginInput(context, telemetry));
      if (request.operation === "schedule") {
        return persist("scheduled_call.schedule", () => scheduledCallStore.schedule(request.input as ScheduleCallInput));
      }
      if (request.operation === "claim_due") {
        return persist("scheduled_call.claim_due", () => scheduledCallStore.claimDue(request.input as ClaimDueInput));
      }
      if (request.operation === "complete") {
        return persist("scheduled_call.complete", () => scheduledCallStore.complete(request.input as CompleteCallInput));
      }
      if (request.operation === "fail") {
        return persist("scheduled_call.fail", () => scheduledCallStore.fail(request.input as FailCallInput));
      }
      if (request.operation === "reset") {
        const reset = request.input as { orgId: string };
        return persist("scheduled_call.reset", () => scheduledCallStore.reset(reset.orgId).then(() => ({ ok: true })));
      }
      throw new Error(`Unknown scheduler operation: ${request.operation}`);
    },
  };

  plugins = await createDemoPluginRegistry({ orgId, appId, telemetry, handlers: pluginHandlers });
  const inferPrebrief: TextInference = async (input) => {
    const startedAt = Date.now();
    const request = new Request("http://demo.local/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            "Write a concise sales prebrief from these structured facts.",
            JSON.stringify({ goal: input.goal, sections: input.sections, memory_count: input.memories.length }),
          ].join("\n"),
        }],
      }),
    });
    try {
      const response = await plugins.dispatch<{ request: Request }, Response>(
        "ai:demo-compatible",
        { request },
        {
          orgId,
          appId,
          sessionId: input.sessionId ?? "prebrief",
          traceId: input.sessionId ?? "prebrief",
          telemetry,
        },
      );
      const payload = await response.clone().json() as {
        choices?: Array<{ message?: { content?: unknown } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      const usage = payload.usage ?? {};
      await telemetry.append({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        orgId,
        appId,
        customerId: input.customer?.customerId ?? null,
        sessionId: input.sessionId ?? null,
        traceId: input.sessionId ?? null,
        channel: "proxy",
        pluginId: "ai:demo-compatible",
        kitId: "kit:debrief",
        type: "inference",
        operation: "prebrief",
        model: "gpt-4o-mini",
        provider: "demo-compatible",
        requestTokens: usage.prompt_tokens ?? null,
        responseTokens: usage.completion_tokens ?? null,
        latencyMs: Date.now() - startedAt,
        estimatedCostUsd: estimateInferenceCost(usage.prompt_tokens, usage.completion_tokens),
        outcome: response.ok ? "success" : "error",
        memoryIds: input.memories.map((memory) => memory.memoryId),
      });
      const content = payload.choices?.[0]?.message?.content;
      return typeof content === "string" ? content : "";
    } catch (error) {
      await telemetry.append({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        orgId,
        appId,
        customerId: input.customer?.customerId ?? null,
        sessionId: input.sessionId ?? null,
        traceId: input.sessionId ?? null,
        channel: "proxy",
        pluginId: "ai:demo-compatible",
        kitId: "kit:debrief",
        type: "inference",
        operation: "prebrief",
        model: "gpt-4o-mini",
        provider: "demo-compatible",
        latencyMs: Date.now() - startedAt,
        estimatedCostUsd: 0,
        outcome: "error",
        memoryIds: input.memories.map((memory) => memory.memoryId),
      });
      throw error;
    }
  };
  const persistenceBoundary: DebriefPersistence = {
    loadSessions: (scopeOrgId, kitId) => debriefStore.loadSessions(scopeOrgId, kitId),
    saveSession: (session) => plugins.dispatch("persistence:libsql", {
      operation: "debrief.session.save",
      run: () => debriefStore.saveSession(session),
    }, sessionPluginContext(session, telemetry)),
    upsertCustomer: (scopeOrgId, identity, scope) => plugins.dispatch("persistence:libsql", {
      operation: "debrief.customer.upsert",
      run: () => debriefStore.upsertCustomer(scopeOrgId, identity),
    }, {
      orgId: scopeOrgId,
      appId,
      sessionId: scope?.sessionId ?? "customer-context",
      traceId: scope?.traceId ?? scope?.sessionId ?? "customer-context",
      telemetry,
    }),
    getCustomer: (scopeOrgId, customerId) => debriefStore.getCustomer(scopeOrgId, customerId),
    listCustomerEvents: (scopeOrgId, customerId, kitId) => debriefStore.listCustomerEvents(scopeOrgId, customerId, kitId),
    appendCustomerEvent: (event) => plugins.dispatch("persistence:libsql", {
      operation: "debrief.customer_event.append",
      run: () => debriefStore.appendCustomerEvent(event),
    }, sessionPluginContext(event, telemetry)),
    getDraft: (scopeOrgId, sessionId) => debriefStore.getDraft(scopeOrgId, sessionId),
    saveDraft: (draft) => plugins.dispatch("persistence:libsql", {
      operation: "debrief.draft.save",
      run: () => debriefStore.saveDraft(draft),
    }, sessionPluginContext(draft, telemetry)),
    reset: (scopeOrgId, kitId) => plugins.dispatch("persistence:libsql", {
      operation: "debrief.reset",
      run: () => debriefStore.reset(scopeOrgId, kitId),
    }, {
      orgId: scopeOrgId,
      appId,
      sessionId: "demo-reset",
      traceId: "demo-reset",
      telemetry,
    }),
  };
  debrief = new DebriefService(memoryBoundary, instructionBoundary, telemetry, { orgId, appId }, inferPrebrief, {
    persistence: persistenceBoundary,
    initialSessions,
  });
  voice = new VoiceSimulator({ debrief, telemetry, orgId, appId });
  const scheduler: ScheduledCallOperations = {
    schedule: (input) => plugins.dispatch("scheduler:scheduled-calls", { operation: "schedule", input }, schedulerPluginContext(input.orgId, input.sessionId, appId, telemetry)),
    claimDue: (input) => plugins.dispatch("scheduler:scheduled-calls", { operation: "claim_due", input }, schedulerPluginContext(input.orgId, "scheduler", appId, telemetry)),
    complete: (input) => plugins.dispatch("scheduler:scheduled-calls", { operation: "complete", input }, schedulerPluginContext(input.orgId, input.scheduledCallId, appId, telemetry)),
    fail: (input) => plugins.dispatch("scheduler:scheduled-calls", { operation: "fail", input }, schedulerPluginContext(input.orgId, input.scheduledCallId, appId, telemetry)),
    get: (scopeOrgId, scheduledCallId) => scheduledCallStore.get(scopeOrgId, scheduledCallId),
    list: (scopeOrgId) => scheduledCallStore.list(scopeOrgId),
    reset: async (scopeOrgId) => {
      await plugins.dispatch("scheduler:scheduled-calls", { operation: "reset", input: { orgId: scopeOrgId } }, schedulerPluginContext(scopeOrgId, "demo-reset", appId, telemetry));
    },
  };

  return {
    client, orgId, appId, telemetry, apps, memory, instructions, debrief, voice, scheduler, plugins, mcpAuthMode, adminToken,
    async reset() {
      debrief.clearSessions();
      await plugins.dispatch("memory:default", {
        operation: "reset",
        context: { orgId, appId, sessionId: "demo-reset", traceId: "demo-reset", parentId: null, kitId: "kit:debrief" },
      }, { orgId, appId, sessionId: "demo-reset", traceId: "demo-reset", telemetry });
      await plugins.dispatch("persistence:libsql", {
        operation: "debrief.reset",
        run: () => debriefStore.reset(orgId, "kit:debrief"),
      }, { orgId, appId, sessionId: "demo-reset", traceId: "demo-reset", telemetry });
      await scheduler.reset(orgId);
      await telemetry.reset();
    },
    async close() {
      await telemetry.close();
      client.close();
    },
  };
}

function schedulerPluginContext(
  orgId: string,
  sessionId: string,
  appId: string | null,
  telemetry: TelemetryStore,
): PluginContextInput {
  return { orgId, appId, sessionId, traceId: sessionId, parentId: null, telemetry };
}

function estimateInferenceCost(promptTokens?: number, completionTokens?: number): number {
  return ((promptTokens ?? 0) * 0.15 + (completionTokens ?? 0) * 0.6) / 1_000_000;
}

function sessionPluginContext(
  value: { orgId: string; appId?: string | null; sessionId: string },
  telemetry: TelemetryStore,
): PluginContextInput {
  return {
    orgId: value.orgId,
    appId: value.appId ?? null,
    sessionId: value.sessionId,
    traceId: value.sessionId,
    telemetry,
  };
}

function contextToPluginInput(
  context: { orgId: string; appId: string | null; sessionId: string; traceId: string; parentId: string | null },
  telemetry: TelemetryStore,
): PluginContextInput {
  return { ...context, telemetry };
}
