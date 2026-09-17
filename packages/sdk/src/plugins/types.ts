/** A stable capability contract provided by a plugin implementation. */
export interface PluginCapability {
  readonly contract: string;
  readonly version: string;
}

/** A capability contract required by a plugin implementation or kit. */
export interface PluginRequirement {
  readonly contract: string;
  readonly version: string;
  readonly optional?: boolean;
}

/** Stable metadata returned with a resolved capability handle. */
export interface ResolvedPluginCapabilityMetadata {
  readonly pluginId: string;
  readonly pluginKind: string;
  readonly pluginVersion: string;
  readonly capabilityContract: string;
  readonly capabilityVersion: string;
  readonly requiredScopes: readonly string[];
}

/** A capability selected from the registry for one contract requirement. */
export interface ResolvedPluginCapability {
  readonly contract: string;
  readonly version: string;
  readonly requirement: PluginRequirement;
  readonly capability: PluginCapability;
  readonly manifest: PluginManifest;
  readonly metadata: ResolvedPluginCapabilityMetadata;
  readonly invoke: <TInput = unknown, TOutput = unknown>(
    input: TInput,
    context?: PluginContext,
  ) => Promise<TOutput>;
}

/**
 * The identity and declared capabilities of a plugin.
 *
 * Manifests are intentionally data-only so hosts can inspect a plugin before
 * initializing or invoking it. `provides` and `requires` are the canonical
 * capability fields. The legacy arrays remain optional for compatibility with
 * older host adapters and are not used for dependency resolution.
 */
export interface PluginManifest {
  readonly id: string;
  readonly kind: string;
  readonly version: string;
  readonly apiVersion: string;
  readonly provides: readonly PluginCapability[];
  readonly requires: readonly PluginRequirement[];
  readonly requiredScopes: readonly string[];
  /** @deprecated Use `provides`. */
  readonly capabilities?: readonly string[];
  /** @deprecated Use `requires`. */
  readonly dependencies?: readonly string[];
}

/**
 * Runtime metadata available to plugin lifecycle hooks and invocations.
 *
 * `lookupPlugin` is retained as a compatibility field for the current debrief
 * runtime. New plugins should receive resolved capability handles instead of
 * discovering arbitrary peers by implementation ID.
 */
export interface PluginContext {
  readonly requestId?: string;
  readonly traceId?: string;
  readonly parentId?: string;
  readonly signal?: AbortSignal;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly lookupPlugin?: (id: string) => Plugin | undefined;
}

/**
 * A runtime capability registered with KitStack.
 *
 * Plugin implementations may be synchronous or asynchronous. Lifecycle hooks
 * are optional so simple stateless adapters only need to provide `invoke`.
 */
export interface Plugin<TInput = unknown, TOutput = unknown> {
  readonly manifest: PluginManifest;
  readonly initialize?: (context: PluginContext) => void | Promise<void>;
  readonly stop?: (context: PluginContext) => void | Promise<void>;
  readonly invoke: (input: TInput, context: PluginContext) => TOutput | Promise<TOutput>;
}

/** Metadata emitted when a plugin is registered. */
export interface PluginRegisteredEvent {
  readonly type: "plugin.registered";
  readonly manifest: PluginManifest;
  readonly registeredAt: string;
  readonly registrationIndex: number;
}

export type PluginRegistryEvent = PluginRegisteredEvent;

export type PluginRegistrationHook = (event: PluginRegisteredEvent) => void;
