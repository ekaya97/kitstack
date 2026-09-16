import { describe, expect, it, vi } from "vitest";
import {
  bindConnector,
  createRestOpenApiConnector,
  type Connector,
  type ConnectorSecretStore,
} from "../src/connectors";

function store(values: Record<string, string>): ConnectorSecretStore {
  return { get: vi.fn(async (reference) => values[reference]) };
}

describe("connector binding contract", () => {
  it("resolves secret references at bind time and does not put values in the binding", async () => {
    const connector: Connector<{ endpoint: string }, { endpoint: string; token: string }> = {
      manifest: { id: "test", version: "0.1.0", capabilities: ["test"], requiredScopes: ["test.read"] },
      bind: vi.fn(async (config, secrets) => ({ endpoint: config.endpoint, token: await secrets.resolve("token") })),
    };
    const secrets = store({ "org/demo/token": "do-not-log-me" });
    const binding = { connectorId: "test", config: { endpoint: "https://example.test" }, secretRefs: { token: "org/demo/token" } };
    const client = await bindConnector(connector, binding, secrets);

    expect(client).toEqual({ endpoint: "https://example.test", token: "do-not-log-me" });
    expect(secrets.get).toHaveBeenCalledWith("org/demo/token");
    expect(JSON.stringify(binding)).not.toContain("do-not-log-me");
    expect(connector.bind).toHaveBeenCalledOnce();
  });

  it("rejects a missing secret and mismatched connector binding", async () => {
    const connector = createRestOpenApiConnector({ id: "rest-test", version: "0.1.0", capabilities: ["rest.request"], requiredScopes: ["rest.read"] });
    await expect(bindConnector(connector, { connectorId: "wrong", config: { baseUrl: "https://api.example.test" } }, store({}))).rejects.toThrow(/does not match/);
    await expect(bindConnector(connector, { connectorId: "rest-test", config: { baseUrl: "https://api.example.test" } }, store({}))).rejects.toThrow(/apiKey/);
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
      { connectorId: "rest-openapi", config: { baseUrl: "https://api.example.test", fetch: fetcher }, secretRefs: { apiKey: "org/demo/rest" } },
      store({ "org/demo/rest": "rest-secret" }),
    );

    await expect(client.request({ path: "/products", query: { id: 42 } })).resolves.toEqual({ id: "42", name: "Food" });
    expect(JSON.stringify(await client.request({ path: "/products", query: { id: 42 } }))).not.toContain("rest-secret");
  });
});
