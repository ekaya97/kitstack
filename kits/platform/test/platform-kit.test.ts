import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KitContext } from "@kitstackco/sdk";
import kit from "../kit.config";
import { createPlatformDataSource, platformAdminRequirement, telemetryRequirement, type PlatformDataReaders, type PlatformSnapshot } from "../src/plugins/platform-data.js";
import { getPlatformOverview, listPlatformGrants } from "../src/tools/platform-tools.js";
import { loader as overviewLoader } from "../src/views/overview/index.js";
import { loader as grantsLoader } from "../src/views/grants/index.js";

function context(source: ReturnType<typeof createPlatformDataSource>, params: Record<string, unknown> = { orgId: "org-demo" }): KitContext {
  return {
    db: {} as KitContext["db"],
    params,
    connectors: {
      get: <T = unknown>() => source as T,
      require: <T = unknown>() => source as T,
      has: () => true,
    },
    identity: { principal: "user-demo", actor: "user-demo" },
    channel: { kind: "mcp" },
    session: { id: "session-1", traceId: "trace-1" },
    telemetry: { event: vi.fn(), metric: vi.fn() },
    audit: { record: vi.fn() },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

const snapshot: PlatformSnapshot = {
  events: [{ id: "event-1", timestamp: "2026-09-16T10:00:00.000Z", orgId: "org-demo", appId: "app-demo", channel: "proxy", type: "inference", operation: "prebrief", outcome: "success", requestTokens: 10, responseTokens: 5, estimatedCostUsd: 0.01 }],
  aggregate: { totalEvents: 1, totalRequestTokens: 10, totalResponseTokens: 5, totalEstimatedCostUsd: 0.01, totalLatencyMs: 100, successCount: 1, errorCount: 0 },
  apps: [{ id: "app-demo", name: "Claude", org: "org-demo", scopes: ["mcp"], createdAt: "2026-09-16T10:00:00.000Z" }],
  kits: [{ id: "debrief", version: "0.1.0", status: "ready" }],
  plugins: [{ id: "memory:default", kind: "memory", version: "0.1.0", status: "ready" }],
  sessions: [{ sessionId: "session-1", appId: "app-demo", kitId: "debrief", state: "active", lastEventAt: "2026-09-16T10:00:00.000Z" }],
  providerHealth: [],
};

function readers(allowed = true): PlatformDataReaders {
  return {
    telemetry: { query: vi.fn(async () => snapshot.events), aggregate: vi.fn(async () => snapshot.aggregate) },
    registry: { apps: vi.fn(() => snapshot.apps), kits: vi.fn(() => snapshot.kits), plugins: vi.fn(() => snapshot.plugins), sessions: vi.fn(() => snapshot.sessions), providerHealth: vi.fn(() => []) },
    grants: { check: vi.fn(async (requirement) => allowed && (requirement.relation === "kit:telemetry" || requirement.relation === "platform:admin")), list: vi.fn(async () => [{ subjectType: "user", subjectId: "user-demo", relation: "kit:telemetry", objectType: "organization", objectId: "org-demo" }]) },
  };
}

describe("platform kit v0", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("defines the platform Views and read tools without debrief dependencies", () => {
    expect(kit.id).toBe("platform");
    expect(kit.tools.map((tool) => tool.name)).toEqual(["get_platform_overview", "get_usage_finops", "list_platform_grants"]);
    expect(kit.views?.map((view) => view.slug)).toEqual(["overview", "usage-finops", "registry", "grants"]);
  });

  it("adapts telemetry and registry readers into one platform source", async () => {
    const input = readers();
    const source = createPlatformDataSource(input);
    const ctx = context(source);
    const query = { orgId: "org-demo", appId: "app-demo", teamId: "team-sales", limit: 100 };
    const result = await source.snapshot(query, ctx);
    expect(result).toEqual(snapshot);
    expect(input.telemetry.query).toHaveBeenCalledWith(query, ctx);
    expect(input.telemetry.aggregate).toHaveBeenCalledWith(query, ctx);
    expect(input.registry.apps).toHaveBeenCalledWith("org-demo", ctx);
  });

  it("enforces telemetry access in tools and direct View loaders", async () => {
    const deniedSource = createPlatformDataSource(readers(false));
    await expect(getPlatformOverview.load(context(deniedSource), { orgId: "org-demo" })).rejects.toThrow("Forbidden");
    await expect(overviewLoader(context(deniedSource))).rejects.toThrow("Forbidden");
  });

  it("requires both telemetry and platform admin access for grants", async () => {
    const source = createPlatformDataSource(readers());
    const ctx = context(source);
    await expect(listPlatformGrants.load(ctx, { orgId: "org-demo" })).resolves.toEqual(expect.any(Array));
    await expect(grantsLoader(ctx)).resolves.toEqual(expect.any(Array));
    expect(platformAdminRequirement()).toEqual({ relation: "platform:admin", objectType: "platform", objectId: "kitstack" });
    expect(telemetryRequirement("org-demo")).toEqual({ relation: "kit:telemetry", objectType: "organization", objectId: "org-demo" });
  });

  it("requires an organization scope for View loads", async () => {
    const source = createPlatformDataSource(readers());
    await expect(overviewLoader(context(source, {}))).rejects.toThrow("params.orgId");
  });
});
