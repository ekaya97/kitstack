import { defineLoader, defineView } from "@kitstackco/sdk";
import { getPlatformOverview } from "../../tools/platform-tools.js";
import { orgIdFromParams } from "../../plugins/platform-data.js";
import { OverviewView } from "./View.js";

export const loader = defineLoader(async (ctx) => getPlatformOverview.load(ctx, { orgId: orgIdFromParams(ctx), limit: 100 }));

export default defineView({
  slug: "overview",
  name: "Platform overview",
  description: "to inspect grant-scoped platform sessions, registry state, and runtime health",
  loader,
  component: OverviewView,
  height: 680,
  placeholder: {
    events: [], aggregate: { totalEvents: 0, totalRequestTokens: 0, totalResponseTokens: 0, totalEstimatedCostUsd: 0, totalLatencyMs: 0, successCount: 0, errorCount: 0 },
    apps: [], kits: [], plugins: [], sessions: [], providerHealth: [],
  },
});
