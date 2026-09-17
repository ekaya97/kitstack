import { assertBindingScope, type BindingScope } from "../binding-scope";

/**
 * Deploy-time connector contract.
 *
 * A kit declares a connector binding (configuration plus secret references).
 * The host resolves those references at bind time and supplies the resulting
 * client through the request-scoped ConnectorRegistry. Secret values are
 * intentionally not part of the binding or client metadata surfaces.
 */

export interface ConnectorManifest {
  readonly id: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly requiredScopes: readonly string[];
  /** Logical names that must be supplied through ConnectorBinding.secretRefs. */
  readonly secretNames?: readonly string[];
}

/** Host-owned secret store. Implementations may use SST, AWS Secrets Manager, or a test map. */
export interface ConnectorSecretStore {
  get(reference: string): Promise<string | undefined>;
}

/** Logical secret lookup exposed to a connector during binding only. */
export interface ConnectorSecretResolver {
  resolve(name: string): Promise<string>;
}

export interface Connector<Config, Client> {
  readonly manifest: ConnectorManifest;
  bind(config: Config, secrets: ConnectorSecretResolver): Promise<Client>;
}

export type ConnectorScope = BindingScope;

/**
 * Binding persisted by the host; it contains references, never secret values.
 * `grantedScopes` is the host authorization decision. `requiredCapabilities`
 * lets a kit assert that the selected implementation provides the operations
 * it needs without introducing a registry or provider-specific dependency.
 */
export interface ConnectorBinding<Config> {
  readonly connectorId: string;
  readonly scope: ConnectorScope;
  readonly config: Config;
  readonly secretRefs?: Readonly<Record<string, string>>;
  readonly grantedScopes?: readonly string[];
  readonly requiredCapabilities?: readonly string[];
}

export interface RedactedConnectorBinding<Config> {
  readonly connectorId: string;
  readonly scope: ConnectorScope;
  readonly config: Config;
  readonly secretRefs: Readonly<Record<string, "[redacted]">>;
  readonly grantedScopes?: readonly string[];
  readonly requiredCapabilities?: readonly string[];
}

export class ConnectorBindingError extends Error {
  readonly code: "invalid" | "scope" | "capability" | "scope_grant" | "secret" | "bind";

  constructor(code: ConnectorBindingError["code"], message: string) {
    super(message);
    this.name = "ConnectorBindingError";
    this.code = code;
  }
}

/**
 * Resolve one connector binding. The returned client is the only object that
 * receives secret material, and the resolver is not retained by the SDK.
 */
export async function bindConnector<Config, Client>(
  connector: Connector<Config, Client>,
  binding: ConnectorBinding<Config>,
  secretStore: ConnectorSecretStore,
): Promise<Client> {
  validateConnectorBinding(connector.manifest, binding);

  const secretRefs = binding.secretRefs ?? {};
  const resolver: ConnectorSecretResolver = {
    async resolve(name) {
      const reference = secretRefs[name];
      if (!reference) throw new ConnectorBindingError("secret", `Connector secret "${name}" is not configured`);
      try {
        const value = await secretStore.get(reference);
        if (!value) throw new Error("missing");
        return value;
      } catch {
        throw new ConnectorBindingError("secret", `Connector secret "${name}" is not configured`);
      }
    },
  };

  try {
    return await connector.bind(binding.config, resolver);
  } catch (error) {
    if (error instanceof ConnectorBindingError) throw error;
    throw new ConnectorBindingError("bind", `Connector "${connector.manifest.id}" failed to bind`);
  }
}

export function validateConnectorBinding<Config>(
  manifest: ConnectorManifest,
  binding: ConnectorBinding<Config>,
): void {
  if (binding.connectorId !== manifest.id) {
    throw new ConnectorBindingError("invalid", `Connector binding "${binding.connectorId}" does not match "${manifest.id}"`);
  }
  try {
    assertBindingScope(binding.scope, "Connector scope");
  } catch {
    throw new ConnectorBindingError("scope", "Connector scope is invalid");
  }
  assertUniqueNonEmpty(manifest.capabilities, "Connector capabilities", "capability");
  assertUniqueNonEmpty(manifest.requiredScopes, "Connector required scopes", "scope");
  assertUniqueNonEmpty(manifest.secretNames ?? [], "Connector secret names", "secret");
  assertUniqueNonEmpty(binding.grantedScopes ?? [], "Granted connector scopes", "scope");
  assertUniqueNonEmpty(binding.requiredCapabilities ?? [], "Required connector capabilities", "capability");

  const provided = new Set(manifest.capabilities);
  for (const capability of binding.requiredCapabilities ?? []) {
    if (!provided.has(capability)) {
      throw new ConnectorBindingError("capability", `Connector does not provide required capability "${capability}"`);
    }
  }

  const granted = new Set(binding.grantedScopes ?? []);
  for (const scope of manifest.requiredScopes) {
    if (!granted.has(scope)) {
      throw new ConnectorBindingError("scope_grant", `Connector scope "${scope}" is not granted`);
    }
  }

  assertSecretSafeConfig(binding.config);
  const secretRefs = binding.secretRefs ?? {};
  for (const name of manifest.secretNames ?? []) {
    if (!secretRefs[name]) throw new ConnectorBindingError("secret", `Connector secret "${name}" is not configured`);
  }
  for (const [name, reference] of Object.entries(secretRefs)) {
    if (!name.trim() || !reference.trim()) throw new ConnectorBindingError("secret", "Connector secret references must be non-empty");
  }
}

/** Safe metadata representation for logs, telemetry, and registry views. */
export function redactConnectorBinding<Config>(binding: ConnectorBinding<Config>): RedactedConnectorBinding<Config> {
  return {
    connectorId: binding.connectorId,
    scope: binding.scope,
    config: binding.config,
    secretRefs: Object.fromEntries(Object.keys(binding.secretRefs ?? {}).map((name) => [name, "[redacted]"])) as Readonly<Record<string, "[redacted]">>,
    ...(binding.grantedScopes ? { grantedScopes: binding.grantedScopes } : {}),
    ...(binding.requiredCapabilities ? { requiredCapabilities: binding.requiredCapabilities } : {}),
  };
}

function assertUniqueNonEmpty(values: readonly string[], label: string, kind: string): void {
  if (new Set(values).size !== values.length || values.some((value) => !value.trim())) {
    throw new ConnectorBindingError("invalid", `${label} must contain unique, non-empty ${kind} names`);
  }
}

function assertSecretSafeConfig(value: unknown, path = "config"): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSecretSafeConfig(item, `${path}[${index}]`));
    return;
  }
  const suspicious = /(api[-_]?key|token|secret|password|private[-_]?key|credential)$/i;
  for (const [key, child] of Object.entries(value)) {
    if (suspicious.test(key) && typeof child === "string" && child.trim()) {
      throw new ConnectorBindingError("secret", `Connector config contains a secret-shaped value at "${path}.${key}"`);
    }
    assertSecretSafeConfig(child, `${path}.${key}`);
  }
}

export interface RestOpenApiRequest {
  readonly path: string;
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly body?: unknown;
}

export interface RestOpenApiConfig {
  readonly baseUrl: string;
  /** Header used for the bound API key; defaults to Authorization. */
  readonly apiKeyHeader?: string;
  /** Test and host transport seam; production defaults to global fetch. */
  readonly fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

export interface RestOpenApiClient {
  request<T = unknown>(request: RestOpenApiRequest): Promise<T>;
}

/** Minimal authenticated REST/OpenAPI connector instance for kit adapters. */
export function createRestOpenApiConnector(
  manifest: ConnectorManifest = {
    id: "rest-openapi",
    version: "0.1.0",
    capabilities: ["rest.request", "openapi.operation"],
    requiredScopes: ["rest.read"],
    secretNames: ["apiKey"],
  },
): Connector<RestOpenApiConfig, RestOpenApiClient> {
  return {
    manifest,
    async bind(config, secrets) {
      const baseUrl = requireHttpUrl(config.baseUrl);
      const apiKey = await secrets.resolve("apiKey");
      const fetcher = config.fetch ?? globalThis.fetch;
      if (!fetcher) throw new Error("A fetch implementation is required for REST connectors");
      const apiKeyHeader = config.apiKeyHeader ?? "Authorization";

      const client: RestOpenApiClient = {
        async request<T>(request: RestOpenApiRequest) {
          const path = request.path.startsWith("/") ? request.path : `/${request.path}`;
          const url = new URL(path, `${baseUrl}/`);
          for (const [key, value] of Object.entries(request.query ?? {})) {
            if (value !== undefined) url.searchParams.set(key, String(value));
          }
          const method = request.method ?? "GET";
          const response = await fetcher(url.toString(), {
            method,
            headers: {
              [apiKeyHeader]: apiKeyHeader.toLowerCase() === "authorization" ? `Bearer ${apiKey}` : apiKey,
              ...(request.body === undefined ? {} : { "content-type": "application/json" }),
            },
            ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
          });
          if (!response.ok) throw new Error(`REST connector request failed with HTTP ${response.status}`);
          if (response.status === 204) return undefined as T;
          return await response.json() as T;
        },
      };
      return client;
    },
  };
}

function requireHttpUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("REST connector base URL must use http:// or https://");
  return url.toString().replace(/\/$/, "");
}
