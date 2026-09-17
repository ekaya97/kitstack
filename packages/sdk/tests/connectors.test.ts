import { describe, expect, it, vi } from "vitest";
import {
  bindConnector,
  createRestOpenApiConnector,
  redactConnectorBinding,
  type Connector,
  type ConnectorSecretStore,
} from "../src/connectors";

function store(values: Record<string, string>): ConnectorSecretStore {
  return { get: vi.fn(async (reference) => values[reference]) };
}

describe("connector binding contract", () => {
  it("resolves secret references at bind time and does not put values in the binding", async () => {
    const connector: Connector<{ endpoint: string }, { endpoint: string; token: string }> = {
      manifest: { id: "test", version: "0.1.0", capabilities: ["test"], requiredScopes: ["test.read"], secretNames: ["token"] },
      bind: vi.fn(async (config, secrets) => ({ endpoint: config.endpoint, token: await secrets.resolve("token") })),
    };
    const secrets = store({ "org/demo/token": "do-not-log-me" });
    const binding = {
      connectorId: "test",
      scope: { orgId: "org-demo", kitId: "kit-test" },
      config: { endpoint: "https://example.test" },
      secretRefs: { token: "org/demo/token" },
      grantedScopes: ["test.read"],
      requiredCapabilities: ["test"],
    };
    const client = await bindConnector(connector, binding, secrets);

    expect(client).toEqual({ endpoint: "https://example.test", token: "do-not-log-me" });
    expect(secrets.get).toHaveBeenCalledWith("org/demo/token");
    expect(JSON.stringify(binding)).not.toContain("do-not-log-me");
    expect(redactConnectorBinding(binding)).toMatchObject({
      scope: { orgId: "org-demo", kitId: "kit-test" },
      secretRefs: { token: "[redacted]" },
    });
    expect(JSON.stringify(redactConnectorBinding(binding))).not.toContain("org/demo/token");
    expect(connector.bind).toHaveBeenCalledOnce();
  });

  it("requires the binding scope, granted scopes, and provided capabilities", async () => {
    const connector = createRestOpenApiConnector({ id: "rest-test", version: "0.1.0", capabilities: ["rest.request"], requiredScopes: ["rest.read"] });
    const base = { connectorId: "rest-test", scope: { orgId: "org-demo", kitId: "kit-test" }, config: { baseUrl: "https://api.example.test" }, secretRefs: { apiKey: "org/demo/api" } };
    await expect(bindConnector(connector, { ...base, scope: undefined as never }, store({}))).rejects.toMatchObject({ code: "scope" });
    await expect(bindConnector(connector, base, store({ "org/demo/api": "secret" }))).rejects.toMatchObject({ code: "scope_grant" });
    await expect(bindConnector(connector, { ...base, grantedScopes: ["rest.read"], requiredCapabilities: ["openapi.operation"] }, store({ "org/demo/api": "secret" }))).rejects.toMatchObject({ code: "capability" });
  });

  it("rejects a missing secret and plaintext secret-shaped config without leaking values", async () => {
    const connector = createRestOpenApiConnector();
    const base = {
      connectorId: "rest-openapi",
      scope: { orgId: "org-demo", kitId: "kit-test" },
      config: { baseUrl: "https://api.example.test" },
      grantedScopes: ["rest.read"],
    };
    await expect(bindConnector(connector, base, store({}))).rejects.toMatchObject({ code: "secret" });
    await expect(bindConnector(connector, { ...base, config: { baseUrl: "https://api.example.test", apiKey: "plaintext-secret" } as unknown as typeof base.config, secretRefs: { apiKey: "org/demo/api" } }, store({ "org/demo/api": "secret" }))).rejects.toMatchObject({ code: "secret" });
    await expect(bindConnector(connector, { ...base, secretRefs: { apiKey: "org/demo/api" } }, store({ "org/demo/api": "secret" }))).resolves.toBeDefined();
  });

  it("keeps the REST client contract transport-only and never echoes its secret", async () => {
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
      expect(input).toBe("https://api.example.test/products?id=42");
      expect(init?.headers).toEqual({ Authorization: "Bearer rest-secret" });
      return new Response(JSON.stringify({ id: "42", name: "Food" }), { status: 200 });
    });
    const connector = createRestOpenApiConnector();
    const client = await bindConnector(
      connector,
      {
        connectorId: "rest-openapi",
        scope: { orgId: "org-demo", kitId: "kit-test" },
        config: { baseUrl: "https://api.example.test", fetch: fetcher },
        secretRefs: { apiKey: "org/demo/rest" },
        grantedScopes: ["rest.read"],
        requiredCapabilities: ["rest.request", "openapi.operation"],
      },
      store({ "org/demo/rest": "rest-secret" }),
    );

    await expect(client.request({ path: "/products", query: { id: 42 } })).resolves.toEqual({ id: "42", name: "Food" });
    expect(JSON.stringify(await client.request({ path: "/products", query: { id: 42 } }))).not.toContain("rest-secret");
  });
});
