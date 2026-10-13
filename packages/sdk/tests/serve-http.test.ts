import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { defineKit } from "../src/define-kit";
import { defineTool } from "../src/define-tool";
import { kit } from "../src/result";
import { createConnectorRegistry } from "../src/connectors/index";
import { createKitServer, serve, type ServeHandle } from "../src/server/index";

const echo = defineTool({
  name: "echo",
  description: "Echo a message",
  args: z.object({ message: z.string() }),
  handler: async (_ctx, args) => kit.text(`echo:${args.message}`),
});

const testKit = defineKit({
  id: "serve-test",
  version: "0.1.0",
  name: "Serve Test",
  description: "Kit for the HTTP host",
  schema: {},
  migrationSql: "SELECT 1;",
  instructions: "",
  tools: [echo],
});

async function rpc(base: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}

describe("serve() HTTP host", () => {
  let handle: ServeHandle | undefined;
  afterEach(async () => { await handle?.close(); handle = undefined; });

  it("serves MCP at a custom path through dispatch, plus health and kit routes", async () => {
    const seen: string[] = [];
    handle = await serve({
      kit: testKit, db: { url: ":memory:" }, transport: "http", port: 0, mcpPath: "/mcp",
      routes: [{ method: "POST", path: /^\/webhooks\/(\w+)$/, handler: (request) => {
        seen.push(`${request.path}:${String(request.body?.CallStatus)}`);
        return { status: 200, body: "<Response/>", headers: { "content-type": "text/xml" } };
      } }],
    });
    const base = `http://127.0.0.1:${handle.port}`;

    expect(await (await fetch(`${base}/healthz`)).json()).toEqual({ status: "ok" });

    const call = await rpc(base, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "kit", arguments: { id: "serve-test", cmd: "echo", params: { message: "hi" } } } });
    expect((await call.json() as any).result.content[0].text).toBe("echo:hi");

    const invalid = await rpc(base, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "kit", arguments: { id: "serve-test", cmd: "echo", params: { message: 42 } } } });
    expect((await invalid.json() as any).result.isError).toBe(true);

    const webhook = await fetch(`${base}/webhooks/twilio`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "CallStatus=completed" });
    expect(webhook.headers.get("content-type")).toBe("text/xml");
    expect(await webhook.text()).toBe("<Response/>");
    expect(seen).toEqual(["/webhooks/twilio:completed"]);

    expect((await fetch(`${base}/unknown`)).status).toBe(404);
  });

  it("uses custom MCP authentication and rejects oversized bodies", async () => {
    handle = await serve({
      kit: testKit, db: { url: ":memory:" }, transport: "http", port: 0, mcpPath: "/mcp", maxBodyBytes: 512,
      authenticate: async (request) => request.headers.authorization === "Bearer good" ? { userId: "user-1" } : { status: 401, body: { error: "unauthorized" } },
    });
    const base = `http://127.0.0.1:${handle.port}`;
    const list = { jsonrpc: "2.0", id: 1, method: "tools/list" };
    expect((await rpc(base, list)).status).toBe(401);
    expect((await rpc(base, list, { authorization: "Bearer good" })).status).toBe(200);
    expect((await rpc(base, { padding: "x".repeat(1024) }, { authorization: "Bearer good" })).status).toBe(413);
  });

  it("rejects requests without a token when an auth adapter is configured", async () => {
    handle = await serve({
      kit: testKit, db: { url: ":memory:" }, transport: "http", port: 0, mcpPath: "/mcp",
      auth: { validate: async (token: string) => token === "good" ? { userId: "u-1" } : null } as any,
    });
    const base = `http://127.0.0.1:${handle.port}`;
    const list = { jsonrpc: "2.0", id: 1, method: "tools/list" };
    expect((await rpc(base, list)).status).toBe(401);
    expect((await rpc(base, list, { authorization: "Bearer bad" })).status).toBe(401);
    expect((await rpc(base, list, { authorization: "Bearer good" })).status).toBe(200);
  });

  it("hands bound connectors to tools as ctx.connectors", async () => {
    const lookup = defineTool({
      name: "lookup",
      description: "Look up a company in the CRM",
      args: z.object({ company: z.string() }),
      handler: async (ctx, args) => kit.text(ctx.connectors.require<{ find(name: string): string }>("crm").find(args.company)),
    });
    const crmKit = defineKit({ ...testKit, id: "crm-test", tools: [lookup] });
    const server = createKitServer({
      kit: crmKit, db: { url: ":memory:" }, transport: "http",
      connectors: createConnectorRegistry({ crm: { find: (name: string) => `found:${name}` } }),
    });
    await expect(server.executeTool("crm-test", "lookup", { company: "Acme" }, "user-1"))
      .resolves.toMatchObject({ content: [{ type: "text", text: "found:Acme" }] });
  });

  it("mounts plugins ahead of kit routes and shuts them down first", async () => {
    const order: string[] = [];
    const server = createKitServer({
      kit: testKit, db: { url: ":memory:" }, transport: "http", port: 0,
      routes: [{ path: /^\//, handler: () => ({ status: 200, body: "kit catch-all" }) }],
      onShutdown: () => { order.push("kit"); },
    });
    server.use({
      routes: [{ method: "GET", path: "/plugin/status", handler: () => ({ status: 200, body: "plugin" }) }],
      onShutdown: () => { order.push("plugin"); },
    });
    handle = await server.listen();
    expect(() => server.use({})).toThrow(/before listen/);
    const base = `http://127.0.0.1:${handle.port}`;
    expect(await (await fetch(`${base}/plugin/status`)).text()).toBe("plugin");
    expect(await (await fetch(`${base}/anything`)).text()).toBe("kit catch-all");
    await handle.close();
    handle = undefined;
    expect(order).toEqual(["plugin", "kit"]);
  });

  it("answers CORS preflight and runs onShutdown before closing", async () => {
    const order: string[] = [];
    handle = await serve({
      kit: testKit, db: { url: ":memory:" }, transport: "http", port: 0,
      cors: { origin: "*" }, onShutdown: () => { order.push("shutdown"); },
    });
    const preflight = await fetch(`http://127.0.0.1:${handle.port}/`, { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
    await handle.close();
    order.push("closed");
    handle = undefined;
    expect(order).toEqual(["shutdown", "closed"]);
  });
});
