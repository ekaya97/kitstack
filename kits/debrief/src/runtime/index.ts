import {
  createDemoPluginRegistry,
  type CreateDemoPluginRegistryOptions,
  type DemoPlugin,
  type DemoPluginId,
  type PluginRegistry,
} from "../plugins/registry/index.js";
import {
  createTelemetryStore,
  type CreateTelemetryStoreOptions,
  type TelemetryQuery,
  type TelemetryStore,
} from "../telemetry/index.js";

export const DEFAULT_DEMO_ORG_ID = "org-demo";
export const DEFAULT_DEMO_RESET_TOKEN = "demo-reset";

export interface DemoRuntimeRequest {
  headers?: Readonly<Record<string, string | undefined>>;
}

export interface DemoRequestContext {
  readonly requestId: string;
  readonly orgId: string;
  readonly appId: string | null;
  readonly sessionId: string;
  readonly traceId: string;
  readonly parentId: string | null;
}

export interface DemoRuntimeOptions extends CreateTelemetryStoreOptions {
  orgId?: string;
  appId?: string | null;
  demoMode?: boolean;
  resetToken?: string;
  now?: () => string;
  createId?: () => string;
  pluginHandlers?: Partial<Record<DemoPluginId, DemoPlugin["invoke"]>>;
}

export interface DemoObservabilityResult {
  events: Awaited<ReturnType<TelemetryStore["query"]>>;
  aggregate: Awaited<ReturnType<TelemetryStore["aggregate"]>>;
}

export class DemoResetGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoResetGuardError";
  }
}

/**
 * The framework-neutral runtime boundary for the unreleased demo.
 *
 * This is intentionally not the production MCP router. It owns the demo
 * database/client lifecycle, bootstraps the five demo plugins, and creates
 * request identity that transport adapters can pass to later capabilities.
 */
export class DemoRuntime {
  readonly telemetry: TelemetryStore;
  readonly plugins: PluginRegistry;
  readonly orgId: string;
  readonly appId: string | null;
  readonly demoMode: boolean;
  readonly resetToken: string;

  private readonly createId: () => string;

  private constructor(
    telemetry: TelemetryStore,
    plugins: PluginRegistry,
    options: Required<Pick<DemoRuntimeOptions, "orgId" | "appId" | "demoMode" | "resetToken">> &
      Pick<DemoRuntimeOptions, "createId">,
  ) {
    this.telemetry = telemetry;
    this.plugins = plugins;
    this.orgId = options.orgId;
    this.appId = options.appId;
    this.demoMode = options.demoMode;
    this.resetToken = options.resetToken;
    this.createId = options.createId ?? (() => crypto.randomUUID());
  }

  static async create(options: DemoRuntimeOptions = {}): Promise<DemoRuntime> {
    const telemetry = await createTelemetryStore({
      url: options.url,
      dbPath: options.dbPath,
      client: options.client,
    });
    const orgId = options.orgId ?? DEFAULT_DEMO_ORG_ID;
    const appId = options.appId ?? null;
    let plugins: PluginRegistry;
    try {
      plugins = await createDemoPluginRegistry({
        orgId,
        appId,
        telemetry,
        now: options.now,
        createEventId: options.createId,
        handlers: options.pluginHandlers,
      } satisfies CreateDemoPluginRegistryOptions);
    } catch (error) {
      await telemetry.close();
      throw error;
    }

    return new DemoRuntime(telemetry, plugins, {
      orgId,
      appId,
      demoMode: options.demoMode ?? true,
      resetToken: options.resetToken ?? DEFAULT_DEMO_RESET_TOKEN,
      createId: options.createId,
    });
  }

  createRequestContext(request: DemoRuntimeRequest = {}): DemoRequestContext {
    const headers = normalizeHeaders(request.headers);
    const requestId = headers["x-request-id"] ?? this.createId();
    return {
      requestId,
      orgId: this.orgId,
      appId: this.appId,
      sessionId: headers["x-session-id"] ?? `session-${requestId}`,
      traceId: headers["x-trace-id"] ?? `trace-${requestId}`,
      parentId: headers["x-parent-id"] ?? null,
    };
  }

  async queryObservability(query: TelemetryQuery = {}): Promise<DemoObservabilityResult> {
    const [events, aggregate] = await Promise.all([
      this.telemetry.query(query),
      this.telemetry.aggregate(query),
    ]);
    return { events, aggregate };
  }

  async querySession(sessionId: string, query: Omit<TelemetryQuery, "sessionId"> = {}): Promise<DemoObservabilityResult> {
    return this.queryObservability({ ...query, sessionId });
  }

  /** Reset only demo-owned metadata. Future app/token stores are preserved. */
  async reset(resetToken: string | undefined): Promise<void> {
    if (!this.demoMode) {
      throw new DemoResetGuardError("Demo reset is disabled outside demo mode");
    }
    if (!resetToken || resetToken !== this.resetToken) {
      throw new DemoResetGuardError("A valid demo reset token is required");
    }
    await this.telemetry.reset();
  }

  async close(): Promise<void> {
    await this.telemetry.close();
  }
}

export async function createDemoRuntime(options: DemoRuntimeOptions = {}): Promise<DemoRuntime> {
  return DemoRuntime.create(options);
}

function normalizeHeaders(headers: DemoRuntimeRequest["headers"]): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value !== undefined) normalized[key.toLowerCase()] = value;
  }
  return normalized;
}
