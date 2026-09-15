import { afterEach, describe, expect, it } from "vitest";
import { createDemoApp } from "./app/index.js";
import type { LiveVoiceHttpOptions } from "./http/voice.js";
import { createDemoServer, type DemoServer, type DemoServerOptions } from "./server.js";

let demoServer: DemoServer | undefined;

afterEach(async () => {
  await demoServer?.close();
  demoServer = undefined;
});

async function request(base: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${base}${path}`, init);
}

interface InjectedLiveVoiceConfig {
  http: LiveVoiceHttpOptions;
  capability: { enabled: true; provider: string; model: string; startPath: string };
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
    expect((await tools.json()).result.tools).toHaveLength(10);

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

  it("serves the protected live start route and capability over real HTTP", async () => {
    const app = await createDemoApp({
      url: ":memory:",
      mcpAuthMode: "app-token",
      adminToken: "live-admin-token",
    });
    const createCall = async (request: Parameters<NonNullable<LiveVoiceHttpOptions["twilio"]>["createCall"]>[0]) => {
      expect(request.to).toBe("+491234567890");
      expect(request.record).toBe(false);
      return { sid: "CA-server-test" };
    };
    const prepared = await app.debrief.prepareDebrief("Qualify the buyer");
    const liveVoice: InjectedLiveVoiceConfig = {
      http: {
        twilio: { createCall },
        telemetry: app.telemetry,
        orgId: app.orgId,
        appId: app.appId,
        mediaStreamUrl: "wss://demo.example/t/voice/media",
        fromNumber: "+491234567891",
        allowedDestinations: ["+491234567890"],
        requireConfirmation: true,
        sessionTokenFor: async (sessionId) => {
          expect(sessionId).toBe(prepared.sessionId);
          return "signed-server-session";
        },
      },
      capability: {
        enabled: true,
        provider: "twilio-openai-realtime",
        model: "gpt-realtime",
        startPath: "/t/voice/live/start",
      },
    };
    demoServer = await createDemoServer({ port: 0, app, liveVoice } satisfies DemoServerOptions);
    const address = await demoServer.listen();
    const base = `http://${address.host}:${address.port}`;

    const start = await request(base, "/t/voice/live/start", {
      method: "POST",
      headers: { "content-type": "application/json", "x-demo-admin-token": app.adminToken },
      body: JSON.stringify({ session_id: prepared.sessionId, to: "+491234567890", confirmation: true }),
    });
    expect(start.status).toBe(202);
    expect(await start.json()).toMatchObject({ callId: "CA-server-test", status: "connecting" });

    const observability = await request(base, "/api/demo/observability");
    expect(observability.status).toBe(200);
    expect(await observability.json()).toEqual(expect.objectContaining({ liveCall: liveVoice.capability }));
  });
});
