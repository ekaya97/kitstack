import { afterEach, describe, expect, it } from "vitest";
import { createDemoApp } from "../composition/app/index.js";
import { createDemoServer, type DemoServer, type DemoServerOptions } from "./server.js";

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
    expect((await tools.json()).result.tools.map((tool: { name: string }) => tool.name)).toEqual(["kit", "kit_view"]);

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
    expect(demoServer.listening).toBe(false);
  });

  it("serves the protected phone start route and capability over real HTTP", async () => {
    const env = {
      TWILIO_ACCOUNT_SID: "ACtest", TWILIO_AUTH_TOKEN: "twilio-test-token", TWILIO_FROM_NUMBER: "+491234567891",
      OPENAI_API_KEY: "sk-test", KITSTACK_DEMO_PUBLIC_HTTPS_URL: "https://demo.example",
      KITSTACK_DEMO_ALLOWED_DESTINATION: "+491234567890",
    };
    const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
    Object.assign(process.env, env);
    try {
      const app = await createDemoApp({ url: ":memory:", mcpAuthMode: "app-token", adminToken: "live-admin-token" });
      const calls: URLSearchParams[] = [];
      const twilioFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        calls.push(new URLSearchParams(String(init?.body)));
        return new Response(JSON.stringify({ sid: "CA-server-test", status: "queued" }), { status: 201 });
      }) as typeof fetch;
      const prepared = await app.debrief.prepareDebrief("Qualify the buyer");
      demoServer = await createDemoServer({ port: 0, app, liveVoiceProviders: { twilioFetch } } satisfies DemoServerOptions);
      const address = await demoServer.listen();
      const base = `http://${address.host}:${address.port}`;
      const body = JSON.stringify({ session_id: prepared.sessionId, to: "+491234567890", confirmation: true });

      const forbidden = await request(base, "/t/voice/live/start", { method: "POST", headers: { "content-type": "application/json" }, body });
      expect(forbidden.status).toBe(403);
      const start = await request(base, "/t/voice/live/start", {
        method: "POST",
        headers: { "content-type": "application/json", "x-demo-admin-token": app.adminToken },
        body,
      });
      expect(start.status).toBe(202);
      expect(await start.json()).toMatchObject({ callId: "CA-server-test", status: "connecting" });
      expect(calls[0].get("To")).toBe("+491234567890");
      expect(calls[0].get("Record")).toBe("false");
      expect(calls[0].get("Twiml")).toContain("wss://demo.example/t/voice/media");

      const observability = await request(base, "/api/demo/observability");
      expect(await observability.json()).toEqual(expect.objectContaining({
        liveCall: { enabled: true, provider: "twilio-openai-realtime", model: "gpt-realtime", startPath: "/t/voice/live/start" },
      }));
      await demoServer.close();
      await app.close();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
