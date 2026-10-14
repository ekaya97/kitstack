import { SignJWT } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { createDemoApp, type DemoApp } from "../../composition/app/index.js";
import { handleDemoAppRequest } from "./app.js";
import { kitCall, kitView, mcpRequest } from "../test-support.js";

let app: DemoApp | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("composed demo HTTP surface", () => {
  it("protects MCP with an app token when explicitly enabled", async () => {
    app = await createDemoApp({ url: ":memory:", mcpAuthMode: "app-token" });
    const missing = await mcpRequest(app, {
      body: { id: 1, method: "tools/list" },
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
    const authenticated = await mcpRequest(app, {
      
      headers: { authorization: `Bearer ${token}` },
      body: { id: 2, method: "tools/list" },
    });
    expect(authenticated.status).toBe(200);
    expect((authenticated.body as any).result.tools.map((tool: { name: string }) => tool.name)).toEqual(["kit", "kit_view"]);
  });

  it("serves the standard HTTP MCP lifecycle", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const initialized = await mcpRequest(app, {
      body: { id: 1, method: "initialize" },
    });
    expect(initialized.body).toMatchObject({
      result: { protocolVersion: "2025-11-25", capabilities: { tools: {} } },
    });
    const ping = await mcpRequest(app, {
      body: { id: 2, method: "ping" },
    });
    expect(ping.body).toMatchObject({ id: 2, result: {} });
    const notification = await mcpRequest(app, {
      body: { jsonrpc: "2.0", method: "notifications/initialized" },
    });
    expect(notification.status).toBe(202);
  });

  it("generates a presenter-shaped customer prebrief with schedule and AI metadata", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const callbackAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const response = await mcpRequest(app, {
      body: {
        id: 11, method: "tools/call", params: kitCall("prepare_debrief", {
            goal: "Prepare the next sales conversation",
            company: " Acme   Corp ",
            contact_name: "Mr John Doe",
            location: "Köln Café",
            callback_at: callbackAt,
            callback_timezone: "Europe/Berlin",
            buffer_minutes: 5,
          }),
      },
    });
    expect(response.status).toBe(200);
    const prepared = JSON.parse(((response.body as any).result.content[0].text)) as Record<string, any>;
    expect(prepared).toMatchObject({
      state: "prepared",
      customer_id: expect.any(String),
      session_id: expect.any(String),
      destination_masked: "configured demo destination",
      kit_view: { kit_id: "debrief", view: "prebrief" },
      prebrief_sections: {
        known: ["Company: Acme Corp", "Contact: Mr John Doe", "Location: Köln Café"],
        last_interaction: "No prior interaction recorded.",
        open_items: ["No open items recorded."],
        call_objective: "Prepare the next sales conversation",
      },
    });
    expect(prepared.prebrief).toContain("Acme Corp");
    expect(Date.parse(prepared.scheduled_call_at)).toBeGreaterThan(Date.parse(prepared.prebrief_ends_at));
    expect(await app.scheduler.list("org-demo")).toEqual([
      expect.objectContaining({ sessionId: prepared.session_id, scheduledAt: prepared.scheduled_call_at, status: "scheduled" }),
    ]);
    const inference = await app.telemetry.query({ sessionId: prepared.session_id, type: "inference" });
    expect(inference).toHaveLength(1);
    expect(inference[0]).toMatchObject({ operation: "prebrief", customerId: prepared.customer_id });

    await app.voice.start(prepared.session_id);
    await app.voice.advance(prepared.session_id);
    await app.voice.complete(prepared.session_id, "partial");
    const learned = await app.debrief.teachFromCorrection(prepared.session_id, "Ask about the implementation timeline.");
    await app.debrief.approve(prepared.session_id, learned.memoryId);
    await app.debrief.publish(prepared.session_id, learned.memoryId);
    await app.debrief.confirmDebrief(prepared.session_id);

    const secondResponse = await mcpRequest(app, {
      body: {
        id: 12, method: "tools/call", params: kitCall("prepare_debrief", {
            goal: "Prepare the next sales conversation",
            company: "Acme Corp",
            contact_name: "Mr John Doe",
            location: "Berlin Office",
            callback_at: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
            callback_timezone: "Europe/Berlin",
          }),
      },
    });
    const second = JSON.parse(((secondResponse.body as any).result.content[0].text)) as Record<string, any>;
    expect(second.customer_id).toBe(prepared.customer_id);
    expect(second.prebrief_sections.last_interaction).toMatch(/^Debrief confirmed on \d{4}-\d{2}-\d{2}/);
    expect(second.prebrief_sections.open_items).toContain("Approved memory: Ask about the implementation timeline.");
  });

  it("runs the confirmation tools through HTTP and returns the confirmation View payload", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const preparedResponse = await mcpRequest(app, {
      body: {
        id: 21, method: "tools/call", params: kitCall("prepare_debrief", {
            goal: "Confirm the opportunity",
            company: "Acme Corp",
            contact_name: "Mr John Doe",
            location: "Köln Café",
            callback_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
            callback_timezone: "Europe/Berlin",
          }),
      },
    });
    const prepared = JSON.parse(((preparedResponse.body as any).result.content[0].text)) as Record<string, string>;
    await app.voice.start(prepared.session_id);
    await app.voice.advance(prepared.session_id);

    const loaded = await mcpRequest(app, {
      body: { id: 22, method: "tools/call", params: kitCall("get_debrief_for_confirmation", { session_id: prepared.session_id }) },
    });
    expect(JSON.parse(((loaded.body as any).result.content[0].text))).toMatchObject({
      session_id: prepared.session_id,
      draft: { status: "draft" },
      kit_view: { view: "confirmation" },
    });

    const updated = await mcpRequest(app, {
      body: {
        id: 23, method: "tools/call", params: kitCall("update_debrief_draft", { session_id: prepared.session_id, next_step: "Send proposal", discovered_address: "Neue Straße 1" }),
      },
    });
    expect(JSON.parse(((updated.body as any).result.content[0].text))).toMatchObject({ draft: { fields: { next_step: "Send proposal" } } });

    const confirmed = await mcpRequest(app, {
      body: { id: 24, method: "tools/call", params: kitCall("confirm_debrief_draft", { session_id: prepared.session_id }) },
    });
    const result = JSON.parse(((confirmed.body as any).result.content[0].text)) as Record<string, string>;
    expect(result).toMatchObject({ state: "confirmed", confirmed_event_id: expect.any(String), address_event_id: expect.any(String) });

    const view = await mcpRequest(app, {
      body: { id: 25, method: "tools/call", params: kitView("confirmation") },
    });
    expect(JSON.parse(((view.body as any).result.content[0].text))).toMatchObject({ data: { state: "confirmed", confirmedEventId: result.confirmed_event_id } });

    const timeline = await mcpRequest(app, {
      body: {
        id: 26, method: "tools/call", params: kitView("customer-timeline", { session_id: prepared.session_id, customer_id: prepared.customer_id }),
      },
    });
    const timelineData = JSON.parse(((timeline.body as any).result.content[0].text)).data;
    expect(timelineData).toMatchObject({ sessionId: prepared.session_id, customerId: prepared.customer_id });
    expect(timelineData.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "debrief_confirmed", details: expect.objectContaining({ outcome: "confirmed" }) }),
      expect.objectContaining({ type: "address_discovered", details: expect.objectContaining({ address: "Neue Straße 1" }) }),
    ]));
    expect(JSON.stringify(timelineData)).not.toContain("+491234567890");

    const other = await app.debrief.prepareDebrief({
      goal: "Other customer", company: "Globex", contactName: "Jane Doe", location: "Berlin Office",
    });
    const isolated = await mcpRequest(app, {
      body: {
        id: 27, method: "tools/call", params: kitView("customer-timeline", { session_id: other.sessionId, customer_id: other.customerId }),
      },
    });
    const isolatedData = JSON.parse(((isolated.body as any).result.content[0].text)).data;
    expect(isolatedData.customerId).toBe(other.customerId);
    expect(isolatedData.events.every((event: { customerId: string }) => event.customerId === other.customerId)).toBe(true);
    expect(isolatedData.events).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ eventId: result.confirmed_event_id }),
    ]));
  });

  it("supports Claude tool discovery and a two-run route dogfood flow", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const list = await mcpRequest(app, {
      body: { id: 1, method: "tools/list" },
    });
    const tools = (list.body as { result: { tools: Array<{ name: string }> } }).result.tools;
    // KitStack exposes kits through `kit` and `kit_view`; the debrief commands are discovered via kit(id).
    expect(tools.map((tool) => tool.name)).toEqual(["kit", "kit_view"]);
    const discovered = await mcpRequest(app, {
      body: { id: 10, method: "tools/call", params: { name: "kit", arguments: { id: "debrief" } } },
    });
    const discovery = (discovered.body as any).result.content[0].text as string;
    for (const command of [
      "prepare_debrief", "prepare_rehearsal", "get_session", "get_debrief", "get_debrief_draft", "get_debrief_for_confirmation", "update_debrief_draft", "confirm_debrief_draft", "confirm_debrief", "teach_from_correction", "approve_memory", "publish_memory", "start_voice_call", "get_voice_status",
    ]) expect(discovery).toContain(command);

    const prepared = await mcpRequest(app, {
      body: {
        id: 2, method: "tools/call", params: kitCall("prepare_rehearsal", { goal: "Improve qualification" }),
      },
    });
    const first = JSON.parse(((prepared.body as any).result.content[0].text)) as { sessionId: string };
    await handleDemoAppRequest(app, { method: "POST", path: "/t/voice/start", body: { session_id: first.sessionId } });
    await handleDemoAppRequest(app, { method: "POST", path: "/t/voice/status", body: { session_id: first.sessionId } });
    await app.voice.complete(first.sessionId, "partial");
    const taught = await mcpRequest(app, {
      body: {
        id: 3, method: "tools/call", params: kitCall("teach_from_correction", { session_id: first.sessionId, correction: "Ask about timeline before price." }),
      },
    });
    const memoryId = JSON.parse(((taught.body as any).result.content[0].text)).memoryId as string;
    await app.debrief.approve(first.sessionId, memoryId);
    await app.debrief.publish(first.sessionId, memoryId);

    const secondResponse = await mcpRequest(app, {
      body: {
        id: 4, method: "tools/call", params: kitCall("prepare_rehearsal", { goal: "Improve qualification" }),
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
    const confirmed = await mcpRequest(app, {
      body: {
        id: 5, method: "tools/call", params: kitCall("confirm_debrief", { session_id: secondPrepared.sessionId, outcome: "confirmed" }),
      },
    });
    expect(JSON.parse(((confirmed.body as any).result.content[0].text)).status).toBe("confirmed");

    const observability = await handleDemoAppRequest(app, {
      method: "GET", path: "/api/demo/observability", query: { appId: "null" },
    });
    const events = (observability.body as any).events as Array<Record<string, unknown>>;
    expect((observability.body as any).plugins).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "persistence:libsql", kind: "persistence", status: "ready" }),
      expect.objectContaining({ id: "ai:demo-compatible", kind: "ai", status: "ready" }),
      expect.objectContaining({ id: "http:demo-routes", kind: "http", status: "ready" }),
    ]));
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

  it("lists registered apps and exposes the configured MCP auth mode to the dashboard", async () => {
    app = await createDemoApp({ url: ":memory:", mcpAuthMode: "app-token" });
    const registered = await handleDemoAppRequest(app, {
      method: "POST", path: "/v1/apps/register",
      headers: { "x-demo-admin-token": "demo-admin-token" },
      body: { name: "Claude", org: "org-demo", scopes: ["inference"] },
    });
    expect(registered.status).toBe(201);

    const apps = await handleDemoAppRequest(app, {
      method: "GET", path: "/v1/apps",
      headers: { "x-demo-admin-token": "demo-admin-token" },
    });
    expect(apps.status).toBe(200);
    expect((apps.body as any).apps).toHaveLength(1);

    const anonymous = await handleDemoAppRequest(app, { method: "GET", path: "/api/demo/observability" });
    expect(anonymous.status).toBe(401);
    const observability = await handleDemoAppRequest(app, {
      method: "GET", path: "/api/demo/observability",
      headers: { "x-demo-admin-token": "demo-admin-token" },
    });
    expect((observability.body as any).mcpAuthMode).toBe("app-token");
    expect((observability.body as any).apps).toEqual([expect.objectContaining({ name: "Claude" })]);
    expect((observability.body as any).kits).toEqual(expect.arrayContaining([expect.objectContaining({ id: "debrief", status: "ready" })]));
    expect((observability.body as any).schedulerJobs).toEqual([]);
    expect((observability.body as any).providerHealth).toEqual(expect.any(Array));
  });

  it("advertises the injected live-call capability in dashboard observability", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const capability = { enabled: true as const, provider: "twilio-openai-realtime", model: "gpt-realtime", startPath: "/t/voice/live/start" };
    const voice = { capabilities: { phone: capability } };

    const response = await handleDemoAppRequest(app, {
      method: "GET",
      path: "/api/demo/observability",
    }, voice);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      liveCall: capability,
    }));
  });
});

describe("telemetry reads with router-signed tokens", () => {
  it("serves observability to a signed router token and refuses a forged one", async () => {
    const secret = "a-router-to-voice-internal-secret-of-32-bytes";
    const previous = { secret: process.env.KITSTACK_DEMO_INTERNAL_SECRET, allow: process.env.KITSTACK_DEMO_INTERNAL_USER_ORG_ALLOWLIST };
    process.env.KITSTACK_DEMO_INTERNAL_SECRET = secret;
    process.env.KITSTACK_DEMO_INTERNAL_USER_ORG_ALLOWLIST = "*=org-demo";
    const app = await createDemoApp({ url: ":memory:", mcpAuthMode: "internal-signed" });
    try {
      const sign = (key: string) => new SignJWT({ org: "org-demo", kit: "debrief", req: "r-1", trace: "t-1" })
        .setProtectedHeader({ alg: "HS256" }).setSubject("user-1")
        .setExpirationTime(Math.floor(Date.now() / 1000) + 60).sign(new TextEncoder().encode(key));
      const read = async (token?: string) => handleDemoAppRequest(app, {
        method: "GET", path: "/api/demo/observability",
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      expect((await read()).status).toBe(401);
      expect((await read(await sign("a-forged-secret-that-is-also-32-bytes-long"))).status).toBe(401);
      expect((await read(await sign(secret))).status).toBe(200);
    } finally {
      await app.close();
      for (const [name, value] of [["KITSTACK_DEMO_INTERNAL_SECRET", previous.secret], ["KITSTACK_DEMO_INTERNAL_USER_ORG_ALLOWLIST", previous.allow]] as const) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});
