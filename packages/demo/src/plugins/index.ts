import type { TelemetryStore } from "../telemetry/index.js";

export const DEMO_PLUGIN_IDS = [
  "persistence:libsql",
  "kit:debrief",
  "memory:default",
  "instructions:debrief-baseline",
  "ai:demo-compatible",
  "http:demo-routes",
  "trigger:voice-http",
  "channel:voice",
  "proxy:demo-openai-compatible",
  "scheduler:scheduled-calls",
] as const;

export type DemoPluginId = (typeof DEMO_PLUGIN_IDS)[number];
export type DemoPluginKind =
  | "persistence"
  | "kit"
  | "memory"
  | "instructions"
  | "ai"
  | "http"
  | "trigger"
  | "channel"
  | "proxy"
  | "scheduler";

export interface DemoPlugin<Input = unknown, Output = unknown> {
  readonly id: string;
  readonly kind: DemoPluginKind;
  readonly version: string;
  readonly invoke: (input: Input, context: DemoPluginContext) => Output | Promise<Output>;
}

export interface DemoPluginContext {
  readonly orgId: string;
  readonly appId: string | null;
  readonly sessionId: string;
  readonly traceId: string;
  readonly parentId: string | null;
  readonly telemetry: TelemetryStore;
  readonly lookupPlugin: (pluginId: string) => DemoPlugin | undefined;
}

export interface PluginContextInput {
  orgId: string;
  appId?: string | null;
  sessionId: string;
  traceId: string;
  parentId?: string | null;
  telemetry: TelemetryStore;
}

export interface PluginRegistryOptions {
  orgId: string;
  appId?: string | null;
  telemetry: TelemetryStore;
  now?: () => string;
  createEventId?: () => string;
}

export class DuplicatePluginError extends Error {
  constructor(pluginId: string) {
    super(`Plugin "${pluginId}" is already registered`);
    this.name = "DuplicatePluginError";
  }
}

export class PluginNotFoundError extends Error {
  constructor(pluginId: string) {
    super(`Plugin "${pluginId}" is not registered`);
    this.name = "PluginNotFoundError";
  }
}

/**
 * In-memory registry for the demo's capability plugins.
 *
 * Registration is kept separate from invocation so the HTTP runtime can use
 * the same lookup boundary for kits, memory, instructions, triggers, and
 * providers. A registration is visible immediately, while its boot telemetry
 * write is awaited by the returned promise.
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, DemoPlugin>();
  private readonly options: Required<Pick<PluginRegistryOptions, "now" | "createEventId">> & PluginRegistryOptions;

  constructor(options: PluginRegistryOptions) {
    this.options = {
      ...options,
      now: options.now ?? (() => new Date().toISOString()),
      createEventId: options.createEventId ?? (() => crypto.randomUUID()),
    };
  }

  /** Register a plugin and persist one metadata-only boot event. */
  register(plugin: DemoPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new DuplicatePluginError(plugin.id);
    }
    this.plugins.set(plugin.id, plugin);

    return this.options.telemetry.append({
      id: this.options.createEventId(),
      timestamp: this.options.now(),
      orgId: this.options.orgId,
      appId: this.options.appId ?? null,
      channel: "system",
      pluginId: plugin.id,
      type: "plugin.registered",
      operation: "register",
      outcome: "success",
    }).then(() => undefined, (error: unknown) => {
      this.plugins.delete(plugin.id);
      throw error;
    });
  }

  lookup(pluginId: string): DemoPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  list(): DemoPlugin[] {
    return [...this.plugins.values()];
  }

  /** Resolve a plugin, create its stable dispatch context, and invoke it. */
  async dispatch<Input, Output>(
    pluginId: string,
    input: Input,
    context: PluginContextInput,
  ): Promise<Output> {
    const plugin = this.lookup(pluginId);
    if (!plugin) {
      throw new PluginNotFoundError(pluginId);
    }

    const pluginContext = createPluginContext(context, this);
    const startedAt = Date.now();
    try {
      const output = await plugin.invoke(input, pluginContext) as Output;
      await this.options.telemetry.append({
        id: this.options.createEventId(),
        timestamp: this.options.now(),
        orgId: context.orgId,
        appId: context.appId ?? null,
        sessionId: context.sessionId,
        parentId: context.parentId ?? null,
        traceId: context.traceId,
        channel: channelForPlugin(plugin.kind),
        pluginId: plugin.id,
        type: "plugin.invoked",
        operation: "invoke",
        latencyMs: Date.now() - startedAt,
        outcome: "success",
      });
      return output;
    } catch (error) {
      try {
        await this.options.telemetry.append({
          id: this.options.createEventId(),
          timestamp: this.options.now(),
          orgId: context.orgId,
          appId: context.appId ?? null,
          sessionId: context.sessionId,
          parentId: context.parentId ?? null,
          traceId: context.traceId,
          channel: channelForPlugin(plugin.kind),
          pluginId: plugin.id,
          type: "plugin.invoked",
          operation: "invoke",
          latencyMs: Date.now() - startedAt,
          outcome: "error",
        });
      } catch {
        // Preserve the plugin failure if telemetry itself is unavailable.
      }
      throw error;
    }
  }
}

export function createPluginContext(
  input: PluginContextInput,
  registry: PluginRegistry,
): DemoPluginContext {
  return {
    orgId: input.orgId,
    appId: input.appId ?? null,
    sessionId: input.sessionId,
    traceId: input.traceId,
    parentId: input.parentId ?? null,
    telemetry: input.telemetry,
    lookupPlugin: (pluginId) => registry.lookup(pluginId),
  };
}

export interface CreateDemoPluginRegistryOptions extends PluginRegistryOptions {
  /** Optional handlers let the runtime bind the real kit/providers later. */
  handlers?: Partial<Record<DemoPluginId, DemoPlugin["invoke"]>>;
}

/**
 * Bootstrap the concrete capability plugins required by the sales voice demo.
 * Connectors intentionally have no registration point in this context.
 */
export async function createDemoPluginRegistry(
  options: CreateDemoPluginRegistryOptions,
): Promise<PluginRegistry> {
  const registry = new PluginRegistry(options);
  for (const plugin of createDemoPlugins(options.handlers)) {
    await registry.register(plugin);
  }
  return registry;
}

export function createDemoPlugins(
  handlers: CreateDemoPluginRegistryOptions["handlers"] = {},
): DemoPlugin[] {
  return [
    createPlugin("persistence:libsql", "persistence", handlers["persistence:libsql"]),
    createPlugin("kit:debrief", "kit", handlers["kit:debrief"]),
    createPlugin("memory:default", "memory", handlers["memory:default"]),
    createPlugin("instructions:debrief-baseline", "instructions", handlers["instructions:debrief-baseline"]),
    createPlugin("ai:demo-compatible", "ai", handlers["ai:demo-compatible"]),
    createPlugin("http:demo-routes", "http", handlers["http:demo-routes"]),
    createPlugin("trigger:voice-http", "trigger", handlers["trigger:voice-http"]),
    createPlugin("channel:voice", "channel", handlers["channel:voice"]),
    createPlugin("proxy:demo-openai-compatible", "proxy", handlers["proxy:demo-openai-compatible"]),
    createPlugin("scheduler:scheduled-calls", "scheduler", handlers["scheduler:scheduled-calls"]),
  ];
}

function createPlugin(
  id: DemoPluginId,
  kind: DemoPluginKind,
  handler?: DemoPlugin["invoke"],
): DemoPlugin {
  return {
    id,
    kind,
    version: "0.1.0",
    invoke: handler ?? ((input) => input),
  };
}

function channelForPlugin(kind: DemoPluginKind): "mcp" | "proxy" | "voice" | "trigger" | "system" | "chat" {
  if (kind === "proxy" || kind === "ai") return "proxy";
  if (kind === "trigger" || kind === "channel" || kind === "scheduler") return "trigger";
  return "system";
}
