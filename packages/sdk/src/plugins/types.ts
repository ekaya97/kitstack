/**
 * The identity and declared capabilities of a plugin.
 *
 * Manifests are intentionally data-only so hosts can inspect a plugin before
 * initializing or invoking it.
 */
export interface PluginManifest {
  readonly id: string;
  readonly kind: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly dependencies: readonly string[];
}

/**
 * Runtime metadata available to plugin lifecycle hooks and invocations.
 *
 * The registry adds `lookupPlugin` when it dispatches a plugin, allowing a
 * plugin to resolve declared collaborators without depending on a concrete
 * registry implementation.
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
