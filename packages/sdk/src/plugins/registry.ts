import type {
  Plugin,
  PluginContext,
  PluginManifest,
  PluginRegisteredEvent,
  PluginRegistrationHook,
  PluginRegistryEvent,
} from "./types";

export interface PluginRegistryOptions {
  /** Called synchronously after a plugin has been registered. */
  readonly onRegister?: PluginRegistrationHook;
}

/** Thrown when a registry operation violates a plugin contract. */
export class PluginRegistryError extends Error {
  readonly code: "PLUGIN_DUPLICATE_ID" | "PLUGIN_NOT_FOUND";

  constructor(code: "PLUGIN_DUPLICATE_ID" | "PLUGIN_NOT_FOUND", message: string) {
    super(message);
    this.name = "PluginRegistryError";
    this.code = code;
  }
}

type PluginListener = (event: PluginRegistryEvent) => void;

/**
 * In-memory registry for the plugins used by a KitStack runtime.
 *
 * Registration order is preserved for deterministic initialization. Plugins
 * are stopped in reverse initialization order, matching normal resource
 * ownership semantics.
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, Plugin>();
  private readonly listeners = new Set<PluginListener>();
  private readonly onRegister?: PluginRegistrationHook;
  private initializedPlugins: Plugin[] = [];
  private lifecycleContext?: PluginContext;
  private nextRegistrationIndex = 0;

  constructor(options: PluginRegistryOptions = {}) {
    this.onRegister = options.onRegister;
  }

  /** Register a plugin, rejecting duplicate IDs. */
  register(plugin: Plugin): void {
    const id = plugin.manifest.id;
    if (this.plugins.has(id)) {
      throw new PluginRegistryError(
        "PLUGIN_DUPLICATE_ID",
        `Plugin "${id}" is already registered`,
      );
    }

    this.plugins.set(id, plugin);

    const event: PluginRegisteredEvent = {
      type: "plugin.registered",
      manifest: snapshotManifest(plugin.manifest),
      registeredAt: new Date().toISOString(),
      registrationIndex: this.nextRegistrationIndex++,
    };

    this.onRegister?.(event);
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /** Register several plugins in order. */
  registerAll(plugins: Iterable<Plugin>): void {
    for (const plugin of plugins) {
      this.register(plugin);
    }
  }

  /** Look up one plugin by its stable manifest ID. */
  get(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  /** Look up all plugins declaring a particular kind. */
  getByKind(kind: string): readonly Plugin[] {
    return [...this.plugins.values()].filter((plugin) => plugin.manifest.kind === kind);
  }

  /** Return all registered plugins in registration order. */
  list(): readonly Plugin[] {
    return [...this.plugins.values()];
  }

  /** Subscribe to future registration events. Returns an unsubscribe function. */
  subscribe(listener: PluginListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Initialize every registered plugin in registration order. */
  async initialize(context: PluginContext = {}): Promise<void> {
    if (this.initializedPlugins.length > 0) {
      return;
    }

    const runtimeContext = this.withRegistryLookup(context);
    const initialized: Plugin[] = [];

    try {
      for (const plugin of this.plugins.values()) {
        await plugin.initialize?.(runtimeContext);
        initialized.push(plugin);
      }
      this.initializedPlugins = initialized;
      this.lifecycleContext = runtimeContext;
    } catch (error) {
      await this.stopPlugins(initialized, runtimeContext);
      throw error;
    }
  }

  /** Stop initialized plugins in reverse initialization order. */
  async stop(context?: PluginContext): Promise<void> {
    const runtimeContext = this.withRegistryLookup(context ?? this.lifecycleContext ?? {});
    const initialized = this.initializedPlugins;
    this.initializedPlugins = [];
    this.lifecycleContext = undefined;
    await this.stopPlugins(initialized, runtimeContext);
  }

  /** Invoke a plugin by ID using a registry-aware runtime context. */
  async invoke<TInput, TOutput>(
    id: string,
    input: TInput,
    context: PluginContext = {},
  ): Promise<TOutput> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw new PluginRegistryError("PLUGIN_NOT_FOUND", `Plugin "${id}" is not registered`);
    }

    return plugin.invoke(input, this.withRegistryLookup(context)) as TOutput | Promise<TOutput>;
  }

  /** Alias for invoke, useful at transport boundaries that dispatch intents. */
  dispatch<TInput, TOutput>(
    id: string,
    input: TInput,
    context: PluginContext = {},
  ): Promise<TOutput> {
    return this.invoke<TInput, TOutput>(id, input, context);
  }

  private withRegistryLookup(context: PluginContext): PluginContext {
    return {
      ...context,
      lookupPlugin: (id: string) => this.get(id),
    };
  }

  private async stopPlugins(plugins: readonly Plugin[], context: PluginContext): Promise<void> {
    for (const plugin of [...plugins].reverse()) {
      await plugin.stop?.(context);
    }
  }
}

function snapshotManifest(manifest: PluginManifest): PluginManifest {
  return {
    ...manifest,
    capabilities: [...manifest.capabilities],
    dependencies: [...manifest.dependencies],
  };
}
