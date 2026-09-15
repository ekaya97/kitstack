import { describe, expect, it, vi } from "vitest";
import { PluginRegistry, type Plugin, type PluginContext, type PluginRegisteredEvent } from "../src";

function plugin(
  id: string,
  kind = "test",
  overrides: Partial<Plugin> = {},
): Plugin {
  return {
    manifest: {
      id,
      kind,
      version: "1.0.0",
      capabilities: ["test.invoke"],
      dependencies: [],
    },
    invoke: vi.fn(async (input) => input),
    ...overrides,
  };
}

describe("PluginRegistry", () => {
  it("rejects duplicate plugin IDs", () => {
    const registry = new PluginRegistry();
    registry.register(plugin("memory"));

    expect(() => registry.register(plugin("memory", "other"))).toThrow(
      'Plugin "memory" is already registered',
    );
  });

  it("looks up plugins by ID and kind and lists them in registration order", () => {
    const memory = plugin("memory", "persistence");
    const instructions = plugin("instructions", "runtime");
    const otherPersistence = plugin("cache", "persistence");
    const registry = new PluginRegistry();

    registry.registerAll([memory, instructions, otherPersistence]);

    expect(registry.get("memory")).toBe(memory);
    expect(registry.get("missing")).toBeUndefined();
    expect(registry.getByKind("persistence")).toEqual([memory, otherPersistence]);
    expect(registry.list()).toEqual([memory, instructions, otherPersistence]);
  });

  it("initializes in registration order and stops in reverse order", async () => {
    const calls: string[] = [];
    const context: PluginContext = { requestId: "request-1" };
    const first = plugin("first", "test", {
      initialize: vi.fn(async (received) => {
        calls.push(`initialize:first:${received.requestId}`);
      }),
      stop: vi.fn(async () => {
        calls.push("stop:first");
      }),
    });
    const second = plugin("second", "test", {
      initialize: vi.fn(async (received) => {
        calls.push(`initialize:second:${received.lookupPlugin?.("first")?.manifest.id}`);
      }),
      stop: vi.fn(async () => {
        calls.push("stop:second");
      }),
    });
    const registry = new PluginRegistry();
    registry.registerAll([first, second]);

    await registry.initialize(context);
    await registry.initialize(context);
    await registry.stop();

    expect(calls).toEqual([
      "initialize:first:request-1",
      "initialize:second:first",
      "stop:second",
      "stop:first",
    ]);
    expect(first.initialize).toHaveBeenCalledTimes(1);
    expect(second.stop).toHaveBeenCalledTimes(1);
  });

  it("emits immutable registration metadata through constructor and subscriptions", () => {
    const constructorEvents: PluginRegisteredEvent[] = [];
    const subscribedEvents: PluginRegisteredEvent[] = [];
    const registry = new PluginRegistry({ onRegister: (event) => constructorEvents.push(event) });
    registry.subscribe((event) => subscribedEvents.push(event));

    registry.register({
      ...plugin("memory", "persistence"),
      manifest: {
        id: "memory",
        kind: "persistence",
        version: "2.3.4",
        capabilities: ["memory.read", "memory.write"],
        dependencies: ["database"],
      },
    });

    expect(constructorEvents).toHaveLength(1);
    expect(subscribedEvents).toHaveLength(1);
    expect(constructorEvents[0]).toMatchObject({
      type: "plugin.registered",
      manifest: {
        id: "memory",
        kind: "persistence",
        version: "2.3.4",
        capabilities: ["memory.read", "memory.write"],
        dependencies: ["database"],
      },
      registrationIndex: 0,
    });
    expect(Date.parse(constructorEvents[0].registeredAt)).not.toBeNaN();

    const manifest = registry.get("memory")?.manifest;
    expect(manifest).toBeDefined();
    (manifest!.capabilities as string[]).push("mutated-outside-registry");
    expect(constructorEvents[0].manifest.capabilities).toEqual(["memory.read", "memory.write"]);
  });

  it("dispatches through a plugin and provides registry lookup context", async () => {
    const dependency = plugin("dependency");
    const target = plugin("target", "test", {
      invoke: vi.fn(async (_input, context) => context.lookupPlugin?.("dependency")?.manifest.id),
    });
    const registry = new PluginRegistry();
    registry.registerAll([dependency, target]);

    await expect(registry.dispatch("target", { value: true })).resolves.toBe("dependency");
    await expect(registry.invoke("missing", {})).rejects.toThrow('Plugin "missing" is not registered');
  });
});
