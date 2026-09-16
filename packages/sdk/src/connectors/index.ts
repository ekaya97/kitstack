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

/** Org-level binding persisted by the host; it contains references, never values. */
export interface ConnectorBinding<Config> {
  readonly connectorId: string;
  readonly config: Config;
  readonly secretRefs?: Readonly<Record<string, string>>;
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
  if (binding.connectorId !== connector.manifest.id) {
    throw new Error(`Connector binding "${binding.connectorId}" does not match "${connector.manifest.id}"`);
  }

  const secretRefs = binding.secretRefs ?? {};
  const resolver: ConnectorSecretResolver = {
    async resolve(name) {
      const reference = secretRefs[name] ?? name;
      const value = await secretStore.get(reference);
      if (!value) throw new Error(`Connector secret "${name}" is not configured`);
      return value;
    },
  };

  return connector.bind(binding.config, resolver);
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
