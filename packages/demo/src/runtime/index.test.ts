import { afterEach, describe, expect, it } from "vitest";
import { createDemoRuntime, type DemoRuntime } from "./index.js";

let runtime: DemoRuntime | undefined;

afterEach(async () => {
  await runtime?.close();
  runtime = undefined;
});

describe("DemoRuntime", () => {
  it("bootstraps a dedicated telemetry store and all demo capability plugins", async () => {
    runtime = await createDemoRuntime({ url: ":memory:", orgId: "org-test" });

    expect(runtime.orgId).toBe("org-test");
    expect(runtime.plugins.list().map((plugin) => plugin.id)).toEqual([
      "persistence:libsql",
      "kit:debrief",
      "memory:default",
      "instructions:debrief-baseline",
      "ai:demo-compatible",
      "http:demo-routes",
      "trigger:voice-http",
      "channel:voice",
      "proxy:demo-openai-compatible",
    ]);
    expect((await runtime.telemetry.query({ type: "plugin.registered" }))).toHaveLength(9);
  });

  it("creates stable request identity from transport headers and runtime identity", async () => {
    runtime = await createDemoRuntime({ url: ":memory:", orgId: "org-test", appId: "app-test" });

    const context = runtime.createRequestContext({
      headers: {
        "X-Request-Id": "request-1",
        "X-Session-Id": "session-1",
        "X-Trace-Id": "trace-1",
        "X-Parent-Id": "parent-1",
      },
    });

    expect(context).toEqual({
      requestId: "request-1",
      orgId: "org-test",
      appId: "app-test",
      sessionId: "session-1",
      traceId: "trace-1",
      parentId: "parent-1",
    });
  });

  it("reset clears telemetry without changing the plugin registry", async () => {
    runtime = await createDemoRuntime({ url: ":memory:", resetToken: "reset-1" });
    const pluginIds = runtime.plugins.list().map((plugin) => plugin.id);

    await runtime.reset("reset-1");

    expect(await runtime.telemetry.query()).toEqual([]);
    expect(runtime.plugins.list().map((plugin) => plugin.id)).toEqual(pluginIds);
  });

  it("rejects reset when demo mode or the token guard is missing", async () => {
    runtime = await createDemoRuntime({ url: ":memory:", demoMode: false, resetToken: "reset-1" });
    await expect(runtime.reset("reset-1")).rejects.toThrow("disabled outside demo mode");

    await runtime.close();
    runtime = await createDemoRuntime({ url: ":memory:", resetToken: "reset-1" });
    await expect(runtime.reset("wrong")).rejects.toThrow("valid demo reset token");
  });
});
