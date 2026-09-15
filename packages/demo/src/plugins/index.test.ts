import { afterEach, describe, expect, it } from "vitest";
import { createTelemetryStore, type TelemetryStore } from "../telemetry/index.js";
import {
  createDemoPluginRegistry,
  createPluginContext,
  DuplicatePluginError,
  PluginNotFoundError,
  PluginRegistry,
  type DemoPlugin,
} from "./index.js";

let telemetry: TelemetryStore | undefined;

afterEach(async () => {
  await telemetry?.close();
  telemetry = undefined;
});

async function makeTelemetry(): Promise<TelemetryStore> {
  telemetry = await createTelemetryStore({ url: ":memory:" });
  return telemetry;
}

function plugin(id: string, kind: DemoPlugin["kind"] = "kit"): DemoPlugin {
  return { id, kind, version: "test", invoke: async (input) => input };
}

describe("PluginRegistry", () => {
  it("registers and looks up a plugin", async () => {
    const store = await makeTelemetry();
    const registry = new PluginRegistry({ orgId: "org-demo", telemetry: store });
    const registered = plugin("kit:test");

    await registry.register(registered);

    expect(registry.lookup("kit:test")).toBe(registered);
    expect(registry.has("kit:test")).toBe(true);
    expect(registry.list()).toEqual([registered]);
  });

  it("rejects duplicate plugin IDs before writing a second event", async () => {
    const store = await makeTelemetry();
    const registry = new PluginRegistry({ orgId: "org-demo", telemetry: store });
    await registry.register(plugin("memory:test", "memory"));

    expect(() => registry.register(plugin("memory:test", "memory"))).toThrow(DuplicatePluginError);
    const events = await store.query({ type: "plugin.registered" });
    expect(events).toHaveLength(1);
  });

  it("creates the concrete demo capability registrations and no connector", async () => {
    const store = await makeTelemetry();
    const registry = await createDemoPluginRegistry({
      orgId: "org-demo",
      appId: null,
      telemetry: store,
      now: () => "2026-09-14T20:00:00.000Z",
      createEventId: (() => {
        let count = 0;
        return () => `plugin-event-${++count}`;
      })(),
    });

    expect(registry.list().map((item) => item.id)).toEqual([
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
    expect(registry.list().map((item) => item.kind)).toEqual([
      "persistence",
      "kit",
      "memory",
      "instructions",
      "ai",
      "http",
      "trigger",
      "channel",
      "proxy",
    ]);
    expect(registry.list().some((item) => item.kind === ("connector" as DemoPlugin["kind"]))).toBe(false);
  });

  it("persists one plugin.registered event per concrete registration", async () => {
    const store = await makeTelemetry();
    await createDemoPluginRegistry({
      orgId: "org-demo",
      appId: null,
      telemetry: store,
      createEventId: (() => {
        let count = 0;
        return () => `plugin-event-${++count}`;
      })(),
    });

    const events = await store.query({ type: "plugin.registered" });
    expect(events).toHaveLength(9);
    expect(events.every((event) => event.appId === null)).toBe(true);
    expect(events.map((event) => event.pluginId)).toEqual([
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
  });

  it("builds a context with nullable app identity and registry lookup", async () => {
    const store = await makeTelemetry();
    const registry = new PluginRegistry({ orgId: "org-demo", telemetry: store });
    const registered = plugin("proxy:test", "proxy");
    await registry.register(registered);

    const context = createPluginContext({
      orgId: "org-demo",
      appId: null,
      sessionId: "session-1",
      traceId: "trace-1",
      parentId: "parent-1",
      telemetry: store,
    }, registry);

    expect(context).toMatchObject({
      orgId: "org-demo",
      appId: null,
      sessionId: "session-1",
      traceId: "trace-1",
      parentId: "parent-1",
      telemetry: store,
    });
    expect(context.lookupPlugin("proxy:test")).toBe(registered);
    expect(context.lookupPlugin("missing")).toBeUndefined();
  });

  it("dispatches through the registry and supplies the stable context", async () => {
    const store = await makeTelemetry();
    let receivedContext;
    const registered: DemoPlugin = {
      ...plugin("kit:dispatch"),
      invoke: async (input, context) => {
        receivedContext = context;
        return { input, found: context.lookupPlugin("kit:dispatch")?.id };
      },
    };
    const registry = new PluginRegistry({ orgId: "org-demo", telemetry: store });
    await registry.register(registered);

    await expect(registry.dispatch("kit:dispatch", { ok: true }, {
      orgId: "org-demo",
      appId: "app-demo",
      sessionId: "session-1",
      traceId: "trace-1",
      telemetry: store,
    })).resolves.toEqual({ input: { ok: true }, found: "kit:dispatch" });
    expect(receivedContext).toMatchObject({
      orgId: "org-demo",
      appId: "app-demo",
      sessionId: "session-1",
      traceId: "trace-1",
      parentId: null,
    });
  });

  it("fails dispatch for an unknown plugin", async () => {
    const store = await makeTelemetry();
    const registry = new PluginRegistry({ orgId: "org-demo", telemetry: store });

    await expect(registry.dispatch("kit:missing", {}, {
      orgId: "org-demo",
      sessionId: "session-1",
      traceId: "trace-1",
      telemetry: store,
    })).rejects.toThrow(PluginNotFoundError);
  });
});
