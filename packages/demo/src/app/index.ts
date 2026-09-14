import { createClient, type Client } from "@libsql/client";
import { createAppRegistry, type AppRegistry } from "../auth/index.js";
import { DebriefService } from "../debrief/index.js";
import { createInstructionPlugin, type InstructionPlugin } from "../instructions/index.js";
import { createMemoryStore, type MemoryStore } from "../memory/index.js";
import { createDemoPluginRegistry, type PluginRegistry } from "../plugins/index.js";
import { createTelemetryStore, type TelemetryStore } from "../telemetry/index.js";
import { VoiceSimulator } from "../voice/index.js";

export interface DemoApp {
  readonly client: Client;
  readonly telemetry: TelemetryStore;
  readonly apps: AppRegistry;
  readonly memory: MemoryStore;
  readonly instructions: InstructionPlugin;
  readonly debrief: DebriefService;
  readonly voice: VoiceSimulator;
  readonly plugins: PluginRegistry;
  reset(): Promise<void>;
}

export interface CreateDemoAppOptions {
  url?: string;
  orgId?: string;
  appId?: string | null;
  secret?: string;
}

export async function createDemoApp(options: CreateDemoAppOptions = {}): Promise<DemoApp> {
  const orgId = options.orgId ?? "org-demo";
  const appId = options.appId ?? null;
  const client = createClient({ url: options.url ?? ":memory:" });
  const telemetry = await createTelemetryStore({ client });
  const apps = createAppRegistry({ secret: options.secret ?? "demo-secret-at-least-32-characters-long" });
  const memory = createMemoryStore(client, telemetry);
  const instructions = createInstructionPlugin({ kitId: "kit:debrief", context: "prebrief" });
  const plugins = await createDemoPluginRegistry({ orgId, appId, telemetry });
  const debrief = new DebriefService(memory, instructions, telemetry, { orgId, appId });
  const voice = new VoiceSimulator({ debrief, telemetry, orgId, appId });

  return {
    client, telemetry, apps, memory, instructions, debrief, voice, plugins,
    async reset() {
      await memory.reset({ orgId, appId, sessionId: "demo-reset", traceId: "demo-reset", parentId: null, kitId: "kit:debrief" });
      await telemetry.reset();
    },
  };
}
