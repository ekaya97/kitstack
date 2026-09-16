import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoRouteDefinitions, handleDemoRequest } from "./index.js";
import { createDemoRuntime, type DemoRuntime } from "../../runtime/index.js";

let runtime: DemoRuntime | undefined;

afterEach(async () => {
  vi.restoreAllMocks();
  await runtime?.close();
  runtime = undefined;
});

describe("demo HTTP boundary", () => {
  it("exposes the four framework-neutral route definitions", async () => {
    runtime = await createDemoRuntime({ url: ":memory:" });
    expect(createDemoRouteDefinitions(runtime).map((route) => `${route.method} ${route.path}`)).toEqual([
      "POST /mcp",
      "POST /api/demo/reset",
      "GET /api/demo/observability",
      "GET /api/demo/sessions/:id",
    ]);
  });

  it("keeps MCP as an explicit unimplemented runtime skeleton", async () => {
    runtime = await createDemoRuntime({ url: ":memory:" });
    const result = await handleDemoRequest(runtime, { method: "POST", path: "/mcp" });
    expect(result.status).toBe(501);
    expect(result.body).toMatchObject({ error: "mcp_not_implemented" });
  });

  it("delegates observability queries to the telemetry store", async () => {
    runtime = await createDemoRuntime({ url: ":memory:" });
    const querySpy = vi.spyOn(runtime.telemetry, "query");
    const aggregateSpy = vi.spyOn(runtime.telemetry, "aggregate");

    const result = await handleDemoRequest(runtime, {
      method: "GET",
      path: "/api/demo/observability",
      query: { sessionId: "session-1", limit: "20" },
    });

    expect(result.status).toBe(200);
    expect(querySpy).toHaveBeenCalledWith({ sessionId: "session-1", limit: 20 });
    expect(aggregateSpy).toHaveBeenCalledWith({ sessionId: "session-1", limit: 20 });
    expect(result.body).toHaveProperty("events");
  });

  it("returns a session trace through the same telemetry boundary", async () => {
    runtime = await createDemoRuntime({ url: ":memory:" });
    const querySpy = vi.spyOn(runtime.telemetry, "query");

    const result = await handleDemoRequest(runtime, {
      method: "GET",
      path: "/api/demo/sessions/session%2F1",
    });

    expect(result.status).toBe(200);
    expect(querySpy).toHaveBeenCalledWith({ sessionId: "session/1" });
  });

  it("guards reset and clears telemetry only with the demo token", async () => {
    runtime = await createDemoRuntime({ url: ":memory:", resetToken: "reset-1" });

    const denied = await handleDemoRequest(runtime, {
      method: "POST",
      path: "/api/demo/reset",
      headers: { "X-Demo-Reset-Token": "wrong" },
    });
    expect(denied.status).toBe(403);
    expect(await runtime.telemetry.query({ type: "plugin.registered" })).toHaveLength(10);

    const accepted = await handleDemoRequest(runtime, {
      method: "POST",
      path: "/api/demo/reset",
      headers: { "x-demo-reset-token": "reset-1" },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toEqual({
      ok: true,
      cleared: ["telemetry_events"],
      preserved: ["app_registry", "token_registry"],
    });
    expect(await runtime.telemetry.query()).toEqual([]);
    expect(runtime.plugins.list()).toHaveLength(10);
  });
});
