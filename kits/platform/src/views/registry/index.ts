import { defineLoader, defineView } from "@kitstackco/sdk";
import { getPlatformOverview } from "../../tools/platform-tools.js";
import { orgIdFromParams } from "../../plugins/platform-data.js";
import { RegistryView } from "./View.js";

export const loader = defineLoader(async (ctx) => getPlatformOverview.load(ctx, { orgId: orgIdFromParams(ctx), limit: 100 }));

export default defineView({
  slug: "registry",
  name: "Apps and plugin registry",
  description: "to inspect grant-scoped registered apps, kits, plugins, and provider health",
  loader,
  component: RegistryView,
  height: 760,
  placeholder: {
    events: [], aggregate: { totalEvents: 0, totalRequestTokens: 0, totalResponseTokens: 0, totalEstimatedCostUsd: 0, totalLatencyMs: 0, successCount: 0, errorCount: 0 },
    apps: [{ id: "app_demo", name: "Claude", org: "org-demo", scopes: ["mcp"], createdAt: "2026-09-16T00:00:00.000Z" }], kits: [{ id: "debrief", version: "0.1.0", status: "ready" }], plugins: [{ id: "memory:default", kind: "memory", version: "0.1.0", status: "ready" }], sessions: [], providerHealth: [],
  },
});
