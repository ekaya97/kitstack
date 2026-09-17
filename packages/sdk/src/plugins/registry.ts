import type {
  Plugin,
  PluginContext,
  PluginManifest,
  PluginRegisteredEvent,
  PluginRegistrationHook,
  PluginRegistryEvent,
  PluginRequirement,
  ResolvedPluginCapability,
} from "./types";

export interface PluginRegistryOptions {
  /** Called synchronously after a plugin has been registered. */
  readonly onRegister?: PluginRegistrationHook;
}

/** Thrown when a registry operation violates a plugin contract. */
export class PluginRegistryError extends Error {
  readonly code:
    | "PLUGIN_DUPLICATE_ID"
    | "PLUGIN_NOT_FOUND"
    | "PLUGIN_INVALID_MANIFEST"
    | "PLUGIN_CAPABILITY_NOT_FOUND"
    | "PLUGIN_CAPABILITY_AMBIGUOUS"
    | "PLUGIN_CAPABILITY_INCOMPATIBLE";

  constructor(
    code: PluginRegistryError["code"],
    message: string,
  ) {
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
    validateManifest(plugin.manifest);
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

  /**
   * Resolve exactly one registered implementation for a capability contract.
   *
   * Resolution is deliberately shallow: it selects a provider and returns a
   * scoped invocation handle. It does not initialize, compose, retry, or
   * otherwise orchestrate plugins.
   */
  resolveCapability(requirement: PluginRequirement): ResolvedPluginCapability {
    validateRequirement(requirement);

    const providers = [...this.plugins.values()]
      .map((plugin) => ({
        plugin,
        capability: plugin.manifest.provides.find(
          (provided) => provided.contract === requirement.contract,
        ),
      }))
      .filter((candidate): candidate is {
        plugin: Plugin;
        capability: PluginManifest["provides"][number];
      } => candidate.capability !== undefined);

    if (providers.length === 0) {
      throw new PluginRegistryError(
        "PLUGIN_CAPABILITY_NOT_FOUND",
        `No provider registered for capability "${requirement.contract}"`,
      );
    }

    const compatible = providers.filter(({ capability }) =>
      versionSatisfies(capability.version, requirement.version),
    );

    if (compatible.length === 0) {
      const registered = providers
        .map(({ plugin, capability }) => `${plugin.manifest.id}@${capability.version}`)
        .sort()
        .join(", ");
      throw new PluginRegistryError(
        "PLUGIN_CAPABILITY_INCOMPATIBLE",
        `No compatible provider for capability "${requirement.contract}@${requirement.version}"; registered: ${registered}`,
      );
    }

    if (compatible.length > 1) {
      const providerIds = compatible
        .map(({ plugin }) => plugin.manifest.id)
        .sort()
        .join(", ");
      throw new PluginRegistryError(
        "PLUGIN_CAPABILITY_AMBIGUOUS",
        `Capability "${requirement.contract}@${requirement.version}" has multiple compatible providers: ${providerIds}`,
      );
    }

    const [{ plugin, capability }] = compatible;
    const manifest = snapshotManifest(plugin.manifest);
    const resolvedRequirement = { ...requirement };
    const metadata = {
      pluginId: manifest.id,
      pluginKind: manifest.kind,
      pluginVersion: manifest.version,
      capabilityContract: capability.contract,
      capabilityVersion: capability.version,
      requiredScopes: [...manifest.requiredScopes],
    };

    return {
      contract: capability.contract,
      version: capability.version,
      requirement: resolvedRequirement,
      capability: { ...capability },
      manifest,
      metadata,
      invoke: async <TInput, TOutput>(input: TInput, context: PluginContext = {}) =>
        plugin.invoke(input, this.withRegistryLookup(context)) as TOutput | Promise<TOutput>,
    };
  }

  /** Short alias for callers that treat resolution as the registry operation. */
  resolve(requirement: PluginRequirement): ResolvedPluginCapability {
    return this.resolveCapability(requirement);
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
    provides: manifest.provides.map((capability) => ({ ...capability })),
    requires: manifest.requires.map((requirement) => ({ ...requirement })),
    requiredScopes: [...manifest.requiredScopes],
    ...(manifest.capabilities ? { capabilities: [...manifest.capabilities] } : {}),
    ...(manifest.dependencies ? { dependencies: [...manifest.dependencies] } : {}),
  };
}

function validateManifest(manifest: PluginManifest): void {
  if (!manifest.apiVersion.trim()) {
    throw new PluginRegistryError("PLUGIN_INVALID_MANIFEST", "Plugin manifest apiVersion is required");
  }
  if (!manifest.id.trim() || !manifest.kind.trim() || !manifest.version.trim()) {
    throw new PluginRegistryError("PLUGIN_INVALID_MANIFEST", "Plugin manifest id, kind, and version are required");
  }
  if (manifest.provides.length === 0) {
    throw new PluginRegistryError("PLUGIN_INVALID_MANIFEST", `Plugin "${manifest.id}" must provide at least one capability`);
  }
  for (const capability of manifest.provides) {
    if (!capability.contract.trim() || !capability.version.trim()) {
      throw new PluginRegistryError("PLUGIN_INVALID_MANIFEST", `Plugin "${manifest.id}" has an invalid provided capability`);
    }
  }
  for (const requirement of manifest.requires) {
    if (!requirement.contract.trim() || !requirement.version.trim() || !isSupportedRange(requirement.version)) {
      throw new PluginRegistryError("PLUGIN_INVALID_MANIFEST", `Plugin "${manifest.id}" has an invalid capability requirement`);
    }
  }
}

function validateRequirement(requirement: PluginRequirement): void {
  if (!requirement.contract.trim() || !requirement.version.trim() || !isSupportedRange(requirement.version)) {
    throw new PluginRegistryError(
      "PLUGIN_INVALID_MANIFEST",
      "Capability requirement contract and version range are required",
    );
  }
}

type SemVer = { major: number; minor: number; patch: number };

/**
 * Small semver subset for capability contracts. It intentionally supports
 * exact versions, caret/tilde ranges, wildcard/partial versions, and simple
 * comparator sets—the range forms needed by plugin manifests.
 */
function versionSatisfies(version: string, range: string): boolean {
  const candidate = parseVersion(version);
  if (!candidate) return false;

  return range.split("||").some((alternative) => {
    const tokens = alternative.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0 || tokens.every((token) => token === "*" || token.toLowerCase() === "x")) {
      return true;
    }

    return tokens.every((token) => satisfiesToken(candidate, token));
  });
}

function satisfiesToken(candidate: SemVer, token: string): boolean {
  if (token === "*" || token.toLowerCase() === "x") return true;

  const operator = token[0] === "^" || token[0] === "~"
    ? token[0]
    : token.startsWith(">=") || token.startsWith("<=")
      ? token.slice(0, 2)
      : token[0] === ">" || token[0] === "<" || token[0] === "="
        ? token[0]
        : "";
  const value = operator ? token.slice(operator.length) : token;
  const parsed = parsePartialVersion(value);
  if (!parsed) return false;

  if (operator === "^") {
    const upper = parsed.version.major > 0
      ? { major: parsed.version.major + 1, minor: 0, patch: 0 }
      : parsed.version.minor > 0
        ? { major: 0, minor: parsed.version.minor + 1, patch: 0 }
        : { major: 0, minor: 0, patch: parsed.version.patch + 1 };
    return compareVersions(candidate, parsed.version) >= 0 && compareVersions(candidate, upper) < 0;
  }

  if (operator === "~") {
    const upper = { major: parsed.version.major, minor: parsed.version.minor + 1, patch: 0 };
    return compareVersions(candidate, parsed.version) >= 0 && compareVersions(candidate, upper) < 0;
  }

  const comparison = compareVersions(candidate, parsed.version);
  if (operator === ">=") return comparison >= 0;
  if (operator === "<=") return comparison <= 0;
  if (operator === ">") return comparison > 0;
  if (operator === "<") return comparison < 0;
  if (operator === "=") return comparison === 0;

  if (parsed.precision === 1) return candidate.major === parsed.version.major;
  if (parsed.precision === 2) {
    return candidate.major === parsed.version.major && candidate.minor === parsed.version.minor;
  }
  return comparison === 0;
}

function isSupportedRange(range: string): boolean {
  return range.split("||").every((alternative) => {
    const tokens = alternative.trim().split(/\s+/).filter(Boolean);
    return tokens.length > 0 && tokens.every((token) =>
      token === "*" || token.toLowerCase() === "x" || Boolean(parseRangeToken(token)),
    );
  });
}

function parseRangeToken(token: string): { version: SemVer } | null {
  const operator = token[0] === "^" || token[0] === "~"
    ? token[0]
    : token.startsWith(">=") || token.startsWith("<=")
      ? token.slice(0, 2)
      : token[0] === ">" || token[0] === "<" || token[0] === "="
        ? token[0]
        : "";
  return parsePartialVersion(operator ? token.slice(operator.length) : token);
}

function parsePartialVersion(value: string): { version: SemVer; precision: 1 | 2 | 3 } | null {
  const parts = value.replace(/^v/, "").split(".");
  if (parts.length < 1 || parts.length > 3) return null;
  const wildcardIndex = parts.findIndex((part) => /^(?:x|\*)$/i.test(part));
  if (wildcardIndex !== -1 && parts.slice(wildcardIndex).some((part) => !/^(?:x|\*)$/i.test(part))) return null;
  const numericParts = wildcardIndex === -1 ? parts : parts.slice(0, wildcardIndex);
  if (numericParts.length === 0 || numericParts.some((part) => !/^\d+$/.test(part))) return null;
  const numbers = numericParts.map(Number);
  return {
    version: { major: numbers[0], minor: numbers[1] ?? 0, patch: numbers[2] ?? 0 },
    precision: numericParts.length as 1 | 2 | 3,
  };
}

function parseVersion(value: string): SemVer | null {
  const parsed = parsePartialVersion(value);
  return parsed?.precision === 3 ? parsed.version : null;
}

function compareVersions(left: SemVer, right: SemVer): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}
