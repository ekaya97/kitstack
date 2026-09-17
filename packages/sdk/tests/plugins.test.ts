import { describe, expect, it, vi } from "vitest";
import {
  PluginRegistry,
  PluginRegistryError,
  type Plugin,
  type PluginContext,
  type PluginRegisteredEvent,
} from "../src";

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
      apiVersion: "kitstack.dev/v1alpha1",
      provides: [{ contract: "kitstack.test", version: "1.0.0" }],
      requires: [],
      requiredScopes: [],
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
        apiVersion: "kitstack.dev/v1alpha1",
        provides: [{ contract: "kitstack.memory", version: "1.0.0" }],
        requires: [{ contract: "kitstack.storage", version: "^1.0.0" }],
        requiredScopes: ["memory:read", "memory:write"],
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
        apiVersion: "kitstack.dev/v1alpha1",
        provides: [{ contract: "kitstack.memory", version: "1.0.0" }],
        requires: [{ contract: "kitstack.storage", version: "^1.0.0" }],
        requiredScopes: ["memory:read", "memory:write"],
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

  it("rejects manifests without a canonical capability declaration", () => {
    const registry = new PluginRegistry();
    expect(() => registry.register({
      ...plugin("invalid"),
      manifest: {
        ...plugin("invalid").manifest,
        provides: [],
      },
    })).toThrow('Plugin "invalid" must provide at least one capability');
  });

  it("resolves an exact capability provider and invokes it through a handle", async () => {
    const provider = plugin("memory-default", "memory", {
      manifest: {
        ...plugin("memory-default", "memory").manifest,
        provides: [{ contract: "kitstack.memory", version: "1.2.3" }],
        requiredScopes: ["memory:read"],
      },
      invoke: vi.fn(async (input, context) => ({ input, requestId: context.requestId })),
    });
    const registry = new PluginRegistry();
    registry.register(provider);

    const resolved = registry.resolveCapability({ contract: "kitstack.memory", version: "1.2.3" });

    expect(resolved.metadata).toEqual({
      pluginId: "memory-default",
      pluginKind: "memory",
      pluginVersion: "1.0.0",
      capabilityContract: "kitstack.memory",
      capabilityVersion: "1.2.3",
      requiredScopes: ["memory:read"],
    });
    await expect(resolved.invoke({ value: true }, { requestId: "request-1" })).resolves.toEqual({
      input: { value: true },
      requestId: "request-1",
    });
    expect(provider.invoke).toHaveBeenCalledTimes(1);
  });

  it("resolves a compatible caret range", () => {
    const provider = plugin("memory-v2", "memory", {
      manifest: {
        ...plugin("memory-v2").manifest,
        provides: [{ contract: "kitstack.memory", version: "1.4.0" }],
      },
    });
    const registry = new PluginRegistry();
    registry.register(provider);

    expect(registry.resolve({ contract: "kitstack.memory", version: "^1.2.0" }).version).toBe("1.4.0");
  });

  it.each([
    ["missing provider", "PLUGIN_CAPABILITY_NOT_FOUND", "kitstack.missing", "1.0.0"],
    ["ambiguous providers", "PLUGIN_CAPABILITY_AMBIGUOUS", "kitstack.memory", "^1.0.0"],
    ["incompatible provider", "PLUGIN_CAPABILITY_INCOMPATIBLE", "kitstack.memory", "^2.0.0"],
  ] as const)("rejects a %s with a stable error", (label, code, contract, version) => {
    const registry = new PluginRegistry();
    registry.register(plugin("memory-a", "memory", {
      manifest: {
        ...plugin("memory-a").manifest,
        provides: [{ contract: "kitstack.memory", version: "1.2.0" }],
      },
    }));
    if (label === "ambiguous providers") {
      registry.register(plugin("memory-b", "memory", {
        manifest: {
          ...plugin("memory-b").manifest,
          provides: [{ contract: "kitstack.memory", version: "1.3.0" }],
        },
      }));
    }

    try {
      registry.resolveCapability({ contract, version });
      throw new Error("expected capability resolution to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PluginRegistryError);
      expect((error as PluginRegistryError).code).toBe(code);
    }
  });

  it("returns detached manifest snapshots with resolved metadata", () => {
    const registry = new PluginRegistry();
    registry.register(plugin("memory", "memory", {
      manifest: {
        ...plugin("memory").manifest,
        provides: [{ contract: "kitstack.memory", version: "1.0.0" }],
        requires: [{ contract: "kitstack.storage", version: "^1.0.0" }],
        requiredScopes: ["memory:read", "memory:write"],
      },
    }));

    const resolved = registry.resolveCapability({ contract: "kitstack.memory", version: "1.0.0" });
    (resolved.manifest.requiredScopes as string[]).push("memory:admin");
    (resolved.requirement as { contract: string }).contract = "mutated";

    expect(resolved.metadata.requiredScopes).toEqual(["memory:read", "memory:write"]);
    expect(registry.resolveCapability({ contract: "kitstack.memory", version: "1.0.0" }).requirement.contract)
      .toBe("kitstack.memory");
  });
});
