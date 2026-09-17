import type { TelemetryStore } from "../../telemetry/index.js";
import {
  PluginRegistry as SdkPluginRegistry,
  type Plugin as SdkPlugin,
  type PluginCapability,
  type PluginContext as SdkPluginContext,
  type PluginRequirement,
} from "@kitstackco/sdk";

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
  readonly provides?: readonly PluginCapability[];
  readonly requires?: readonly PluginRequirement[];
  readonly requiredScopes?: readonly string[];
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
  private readonly sdkRegistry = new SdkPluginRegistry();
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
    this.sdkRegistry.register(asSdkPlugin(plugin, this));
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

    const startedAt = Date.now();
    try {
      const output = await this.sdkRegistry.dispatch<Input, Output>(pluginId, input, {
        requestId: context.sessionId,
        traceId: context.traceId,
        parentId: context.parentId ?? undefined,
        metadata: {
          orgId: context.orgId,
          appId: context.appId ?? null,
          telemetry: context.telemetry,
        },
      });
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

  /** The SDK registry is the canonical invocation/lifecycle implementation. */
  get sdk(): SdkPluginRegistry {
    return this.sdkRegistry;
  }
}

function asSdkPlugin(plugin: DemoPlugin, registry: PluginRegistry): SdkPlugin {
  return {
    manifest: {
      id: plugin.id,
      kind: plugin.kind,
      version: plugin.version,
      apiVersion: "kitstack.dev/v1alpha1",
      provides: plugin.provides ?? [{ contract: `kitstack.${plugin.kind}`, version: plugin.version }],
      requires: plugin.requires ?? [],
      requiredScopes: plugin.requiredScopes ?? [],
      capabilities: plugin.provides?.map((capability) => capability.contract),
      dependencies: plugin.requires?.map((requirement) => requirement.contract),
    },
    invoke: (input, context) => plugin.invoke(input, createPluginContextFromSdk(context, registry)),
  };
}

function createPluginContextFromSdk(
  context: SdkPluginContext,
  registry: PluginRegistry,
): DemoPluginContext {
  const metadata = context.metadata ?? {};
  return {
    orgId: typeof metadata.orgId === "string" ? metadata.orgId : "org-demo",
    appId: typeof metadata.appId === "string" ? metadata.appId : null,
    sessionId: context.requestId ?? "plugin-session",
    traceId: context.traceId ?? "plugin-trace",
    parentId: context.parentId ?? null,
    telemetry: metadata.telemetry as TelemetryStore,
    lookupPlugin: (pluginId) => registry.lookup(pluginId),
  };
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
  const metadata = DEMO_PLUGIN_METADATA[id];
  return {
    id,
    kind,
    version: "0.1.0",
    provides: metadata.provides,
    requires: metadata.requires,
    requiredScopes: metadata.requiredScopes,
    invoke: handler ?? ((input) => input),
  };
}

const DEMO_PLUGIN_METADATA: Record<DemoPluginId, {
  provides: readonly PluginCapability[];
  requires: readonly PluginRequirement[];
  requiredScopes: readonly string[];
}> = {
  "persistence:libsql": {
    provides: [{ contract: "kitstack.storage", version: "0.1.0" }],
    requires: [],
    requiredScopes: ["storage:read", "storage:write"],
  },
  "kit:debrief": {
    provides: [{ contract: "kitstack.kit", version: "0.1.0" }],
    requires: [
      { contract: "kitstack.memory", version: "0.1.0" },
      { contract: "kitstack.instructions", version: "0.1.0" },
      { contract: "kitstack.scheduler", version: "0.1.0" },
    ],
    requiredScopes: ["kit:use", "kit:act"],
  },
  "memory:default": {
    provides: [{ contract: "kitstack.memory", version: "0.1.0" }],
    requires: [{ contract: "kitstack.storage", version: "0.1.0" }],
    requiredScopes: ["memory:read", "memory:write"],
  },
  "instructions:debrief-baseline": {
    provides: [{ contract: "kitstack.instructions", version: "0.1.0" }],
    requires: [],
    requiredScopes: ["instructions:read"],
  },
  "ai:demo-compatible": {
    provides: [{ contract: "kitstack.ai", version: "0.1.0" }],
    requires: [],
    requiredScopes: ["ai:invoke"],
  },
  "http:demo-routes": {
    provides: [{ contract: "kitstack.http", version: "0.1.0" }],
    requires: [],
    requiredScopes: ["http:invoke"],
  },
  "trigger:voice-http": {
    provides: [{ contract: "kitstack.trigger", version: "0.1.0" }],
    requires: [],
    requiredScopes: ["trigger:invoke"],
  },
  "channel:voice": {
    provides: [{ contract: "kitstack.channel.voice", version: "0.1.0" }],
    requires: [{ contract: "kitstack.ai", version: "0.1.0" }],
    requiredScopes: ["channel:voice"],
  },
  "proxy:demo-openai-compatible": {
    provides: [{ contract: "kitstack.proxy", version: "0.1.0" }],
    requires: [{ contract: "kitstack.ai", version: "0.1.0" }],
    requiredScopes: ["proxy:invoke"],
  },
  "scheduler:scheduled-calls": {
    provides: [{ contract: "kitstack.scheduler", version: "0.1.0" }],
    requires: [{ contract: "kitstack.storage", version: "0.1.0" }],
    requiredScopes: ["scheduler:read", "scheduler:write"],
  },
};

function channelForPlugin(kind: DemoPluginKind): "mcp" | "proxy" | "voice" | "trigger" | "system" | "chat" {
  if (kind === "proxy" || kind === "ai") return "proxy";
  if (kind === "trigger" || kind === "channel" || kind === "scheduler") return "trigger";
  return "system";
}
