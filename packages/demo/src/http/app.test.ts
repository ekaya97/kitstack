import { afterEach, describe, expect, it } from "vitest";
import { createDemoApp, type DemoApp } from "../app/index.js";
import { handleDemoAppRequest } from "./app.js";

let app: DemoApp | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("composed demo HTTP surface", () => {
  it("protects MCP with an app token when explicitly enabled", async () => {
    app = await createDemoApp({ url: ":memory:", mcpAuthMode: "app-token" });
    const missing = await handleDemoAppRequest(app, {
      method: "POST", path: "/mcp", body: { id: 1, method: "tools/list" },
    });
    expect(missing.status).toBe(401);
    expect(missing.headers["www-authenticate"]).toBe("Bearer");
    const unguardedRegistration = await handleDemoAppRequest(app, {
      method: "POST", path: "/v1/apps/register",
      body: { name: "Blocked", org: app.orgId, scopes: ["mcp"] },
    });
    expect(unguardedRegistration.status).toBe(403);

    const registered = await handleDemoAppRequest(app, {
      method: "POST", path: "/v1/apps/register",
      headers: { "x-demo-admin-token": app.adminToken },
      body: { name: "Authenticated Claude", org: app.orgId, scopes: ["mcp"] },
    });
    const appId = (registered.body as any).id as string;
    const issued = await handleDemoAppRequest(app, { method: "POST", path: `/v1/apps/${appId}/token`, headers: { "x-demo-admin-token": app.adminToken } });
    const token = (issued.body as any).token as string;
    const authenticated = await handleDemoAppRequest(app, {
      method: "POST", path: "/mcp",
      headers: { authorization: `Bearer ${token}` },
      body: { id: 2, method: "tools/list" },
    });
    expect(authenticated.status).toBe(200);
    expect((authenticated.body as any).result.tools).toHaveLength(7);
  });

  it("serves the standard HTTP MCP lifecycle", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const initialized = await handleDemoAppRequest(app, {
      method: "POST", path: "/mcp", body: { id: 1, method: "initialize" },
    });
    expect(initialized.body).toMatchObject({
      result: { protocolVersion: "2025-11-25", capabilities: { tools: {} } },
    });
    const ping = await handleDemoAppRequest(app, {
      method: "POST", path: "/mcp", body: { id: 2, method: "ping" },
    });
    expect(ping.body).toMatchObject({ id: 2, result: {} });
    const notification = await handleDemoAppRequest(app, {
      method: "POST", path: "/mcp", body: { jsonrpc: "2.0", method: "notifications/initialized" },
    });
    expect(notification.status).toBe(204);
  });

  it("supports Claude tool discovery and a two-run route dogfood flow", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const list = await handleDemoAppRequest(app, {
      method: "POST", path: "/mcp", body: { id: 1, method: "tools/list" },
    });
    const tools = (list.body as { result: { tools: Array<{ name: string }> } }).result.tools;
    expect(tools.map((tool) => tool.name)).toEqual([
      "prepare_debrief", "get_session", "get_debrief", "confirm_debrief", "teach_from_correction", "approve_memory", "publish_memory",
    ]);

    const prepared = await handleDemoAppRequest(app, {
      method: "POST", path: "/mcp", body: {
        id: 2, method: "tools/call", params: { name: "prepare_debrief", arguments: { goal: "Improve qualification" } },
      },
    });
    const first = JSON.parse(((prepared.body as any).result.content[0].text)) as { sessionId: string };
    await handleDemoAppRequest(app, { method: "POST", path: "/t/voice/start", body: { session_id: first.sessionId } });
    await handleDemoAppRequest(app, { method: "POST", path: "/t/voice/status", body: { session_id: first.sessionId } });
    await app.voice.complete(first.sessionId, "partial");
    const taught = await handleDemoAppRequest(app, {
      method: "POST", path: "/mcp", body: {
        id: 3, method: "tools/call", params: {
          name: "teach_from_correction", arguments: { session_id: first.sessionId, correction: "Ask about timeline before price." },
        },
      },
    });
    const memoryId = JSON.parse(((taught.body as any).result.content[0].text)).memoryId as string;
    await app.debrief.approve(first.sessionId, memoryId);
    await app.debrief.publish(first.sessionId, memoryId);

    const secondResponse = await handleDemoAppRequest(app, {
      method: "POST", path: "/mcp", body: {
        id: 4, method: "tools/call", params: {
          name: "prepare_debrief", arguments: { goal: "Improve qualification" },
        },
      },
    });
    const secondPrepared = JSON.parse(((secondResponse.body as any).result.content[0].text)) as {
      sessionId: string; memoryIds: string[];
    };
    expect(secondPrepared.sessionId).not.toBe(first.sessionId);
    expect(secondPrepared.memoryIds).toContain(memoryId);
    await handleDemoAppRequest(app, {
      method: "POST", path: "/t/voice/start", body: { session_id: secondPrepared.sessionId },
    });
    await handleDemoAppRequest(app, {
      method: "POST", path: "/t/voice/status", body: { session_id: secondPrepared.sessionId },
    });
    const confirmed = await handleDemoAppRequest(app, {
      method: "POST", path: "/mcp", body: {
        id: 5, method: "tools/call", params: {
          name: "confirm_debrief", arguments: { session_id: secondPrepared.sessionId, outcome: "confirmed" },
        },
      },
    });
    expect(JSON.parse(((confirmed.body as any).result.content[0].text)).state).toBe("confirmed");

    const observability = await handleDemoAppRequest(app, {
      method: "GET", path: "/api/demo/observability", query: { appId: "null" },
    });
    const events = (observability.body as any).events as Array<Record<string, unknown>>;
    expect(events.some((event) => event.sessionId === first.sessionId && event.memoryIds)).toBe(true);
    expect(events.some((event) => event.sessionId === secondPrepared.sessionId && event.instructionVersions)).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/transcript|audio|completion/i);
  });

  it("registers/tokenizes apps, meters proxy use, and resets without losing credentials", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const registered = await handleDemoAppRequest(app, {
      method: "POST", path: "/v1/apps/register", body: { name: "Claude", org: "org-demo", scopes: ["inference"] },
    });
    const appId = (registered.body as any).id as string;
    const issued = await handleDemoAppRequest(app, { method: "POST", path: `/v1/apps/${appId}/token` });
    const token = (issued.body as any).token as string;
    const proxy = await handleDemoAppRequest(app, {
      method: "POST", path: "/v1/chat/completions",
      headers: { authorization: `Bearer ${token}`, "x-kitstack-session-id": "proxy-session" },
      body: { model: "gpt-4o-mini", messages: [{ role: "user", content: "Extract next step" }] },
    });
    expect(proxy.status).toBe(200);
    expect((await app.telemetry.query({ type: "inference" }))).toHaveLength(1);

    const reset = await handleDemoAppRequest(app, {
      method: "POST", path: "/api/demo/reset", headers: { "x-demo-reset-token": "demo-reset" },
    });
    expect(reset.status).toBe(200);
    expect(app.apps.get(appId)?.id).toBe(appId);
    await expect(app.apps.verify(token)).resolves.toMatchObject({ sub: appId });
  });
});
