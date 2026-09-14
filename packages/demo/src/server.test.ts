import { afterEach, describe, expect, it } from "vitest";
import { createDemoServer, type DemoServer } from "./server.js";

let demoServer: DemoServer | undefined;

afterEach(async () => {
  await demoServer?.close();
  demoServer = undefined;
});

async function request(base: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${base}${path}`, init);
}

describe("local demo HTTP server", () => {
  it("serves MCP tool discovery and observability over real HTTP", async () => {
    demoServer = await createDemoServer({ port: 0 });
    const address = await demoServer.listen();
    const base = `http://${address.host}:${address.port}`;

    const tools = await request(base, "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 1, method: "tools/list" }),
    });
    expect(tools.status).toBe(200);
    expect((await tools.json()).result.tools).toHaveLength(5);

    const observability = await request(base, "/api/demo/observability?appId=null&limit=5");
    expect(observability.status).toBe(200);
    expect((await observability.json())).toEqual(expect.objectContaining({ events: expect.any(Array), aggregate: expect.any(Object) }));
  });

  it("handles CORS preflight, forwards headers/query, and bounds JSON bodies", async () => {
    demoServer = await createDemoServer({ port: 0, maxBodyBytes: 32 });
    const address = await demoServer.listen();
    const base = `http://${address.host}:${address.port}`;

    const options = await request(base, "/mcp", { method: "OPTIONS" });
    expect(options.status).toBe(204);
    expect(options.headers.get("access-control-allow-origin")).toBe("*");

    const oversized = await request(base, "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "tools/list", padding: "too large" }),
    });
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toMatchObject({ error: "body_too_large" });
  });

  it("closes the owned app and server gracefully", async () => {
    demoServer = await createDemoServer({ port: 0 });
    await demoServer.listen();
    await demoServer.close();
    await demoServer.close();
    expect(demoServer.server.listening).toBe(false);
  });
});
