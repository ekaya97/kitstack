import { createClient, type Client } from "@libsql/client";
import { createAppRegistry, type AppRegistry } from "../auth/index.js";
import type { McpAuthMode } from "../auth/mcp.js";
import { DebriefService, type MemoryStoreLike } from "../debrief/index.js";
import { createInstructionPlugin, type InstructionPlugin } from "../instructions/index.js";
import { createMemoryStore, type MemoryContext, type MemoryReadQuery, type MemoryStore, type MemoryWriteInput } from "../memory/index.js";
import { createDemoPluginRegistry, type DemoPluginContext, type PluginContextInput, type PluginRegistry } from "../plugins/index.js";
import { handleProxyRequest } from "../proxy/index.js";
import { createTelemetryStore, type TelemetryStore } from "../telemetry/index.js";
import { VoiceSimulator } from "../voice/index.js";

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
  const apps = createAppRegistry({ secret: options.secret ?? "demo-secret-at-least-32-characters-long" });
  const memory = createMemoryStore(client, telemetry);
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
      const request = input as { operation: string; sessionId?: string; goal?: string; correction?: string; outcome?: "confirmed" | "partial"; memoryId?: string };
      if (request.operation === "prepare") return debrief.prepareDebrief(request.goal ?? "");
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
  };

  plugins = await createDemoPluginRegistry({ orgId, appId, telemetry, handlers: pluginHandlers });
  debrief = new DebriefService(memoryBoundary, instructionBoundary, telemetry, { orgId, appId });
  voice = new VoiceSimulator({ debrief, telemetry, orgId, appId });

  return {
    client, orgId, appId, telemetry, apps, memory, instructions, debrief, voice, plugins, mcpAuthMode, adminToken,
    async reset() {
      debrief.clearSessions();
      await plugins.dispatch("memory:default", {
        operation: "reset",
        context: { orgId, appId, sessionId: "demo-reset", traceId: "demo-reset", parentId: null, kitId: "kit:debrief" },
      }, { orgId, appId, sessionId: "demo-reset", traceId: "demo-reset", telemetry });
      await telemetry.reset();
    },
    async close() {
      await telemetry.close();
      client.close();
    },
  };
}

function contextToPluginInput(
  context: { orgId: string; appId: string | null; sessionId: string; traceId: string; parentId: string | null },
  telemetry: TelemetryStore,
): PluginContextInput {
  return { ...context, telemetry };
}
