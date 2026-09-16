import { defineLoader, defineView } from "@kitstackco/sdk";
import { getUsageFinops } from "../../tools/platform-tools.js";
import { orgIdFromParams } from "../../plugins/platform-data.js";
import { UsageFinopsView } from "./View.js";

export const loader = defineLoader(async (ctx) => getUsageFinops.load(ctx, { orgId: orgIdFromParams(ctx), limit: 1000 }));

export default defineView({
  slug: "usage-finops",
  name: "Usage and FinOps",
  description: "to inspect grant-scoped proxy usage, observability, latency, tokens, and estimated cost",
  loader,
  component: UsageFinopsView,
  height: 760,
  placeholder: {
    events: [], aggregate: { totalEvents: 0, totalRequestTokens: 0, totalResponseTokens: 0, totalEstimatedCostUsd: 0, totalLatencyMs: 0, successCount: 0, errorCount: 0 },
    apps: [], kits: [], plugins: [], sessions: [], providerHealth: [],
  },
});
