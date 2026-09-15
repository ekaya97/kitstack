import { createClient, type Client } from "@libsql/client";
import { createAppRegistry, type AppRegistry } from "../auth/index.js";
import type { McpAuthMode } from "../auth/mcp.js";
import { DebriefService } from "../debrief/index.js";
import { createInstructionPlugin, type InstructionPlugin } from "../instructions/index.js";
import { createMemoryStore, type MemoryStore } from "../memory/index.js";
import { createDemoPluginRegistry, type PluginRegistry } from "../plugins/index.js";
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
  const client = createClient({ url: options.url ?? ":memory:" });
  const telemetry = await createTelemetryStore({ client });
  const apps = createAppRegistry({ secret: options.secret ?? "demo-secret-at-least-32-characters-long" });
  const memory = createMemoryStore(client, telemetry);
  const instructions = createInstructionPlugin({ kitId: "kit:debrief", context: "prebrief" });
  const plugins = await createDemoPluginRegistry({ orgId, appId, telemetry });
  const debrief = new DebriefService(memory, instructions, telemetry, { orgId, appId });
  const voice = new VoiceSimulator({ debrief, telemetry, orgId, appId });

  return {
    client, orgId, appId, telemetry, apps, memory, instructions, debrief, voice, plugins, mcpAuthMode, adminToken,
    async reset() {
      debrief.clearSessions();
      await memory.reset({ orgId, appId, sessionId: "demo-reset", traceId: "demo-reset", parentId: null, kitId: "kit:debrief" });
      await telemetry.reset();
    },
    async close() {
      await telemetry.close();
      client.close();
    },
  };
}
