import { defineTool, kit, type KitContext } from "@kitstackco/sdk";
import { z } from "zod";
import {
  assertPlatformAccess,
  getPlatformDataSource,
  platformAdminRequirement,
  telemetryRequirement,
  type PlatformQuery,
} from "../plugins/platform-data.js";

const queryArgs = z.object({
  orgId: z.string().min(1).describe("Organization whose platform data may be viewed"),
  appId: z.string().optional().describe("Optional registered app filter"),
  teamId: z.string().optional().describe("Optional team scope enforced by the platform host"),
  kitId: z.string().optional().describe("Optional kit filter"),
  pluginId: z.string().optional().describe("Optional plugin filter"),
  sessionId: z.string().optional().describe("Optional session filter"),
  limit: z.number().int().positive().max(1000).optional().describe("Maximum event rows"),
});

type QueryArgs = z.infer<typeof queryArgs>;
const toQuery = (args: QueryArgs): PlatformQuery => ({ ...args, appId: args.appId ?? null });

async function requireTelemetry(ctx: KitContext, orgId: string) {
  const source = getPlatformDataSource(ctx);
  await assertPlatformAccess(source, telemetryRequirement(orgId), ctx);
  return source;
}

export const getPlatformOverview = defineTool({
  name: "get_platform_overview",
  description: "Read grant-scoped platform sessions, registry metadata, and runtime health.",
  args: queryArgs,
  authorize: (args) => [telemetryRequirement(args.orgId)],
  load: async (ctx, args) => {
    const source = await requireTelemetry(ctx, args.orgId);
    return source.snapshot(toQuery(args), ctx);
  },
});

export const getUsageFinops = defineTool({
  name: "get_usage_finops",
  description: "Read grant-scoped proxy usage, observability events, latency, tokens, and cost.",
  args: queryArgs,
  authorize: (args) => [telemetryRequirement(args.orgId)],
  load: async (ctx, args) => {
    const source = await requireTelemetry(ctx, args.orgId);
    return source.snapshot(toQuery(args), ctx);
  },
});

export const listPlatformGrants = defineTool({
  name: "list_platform_grants",
  description: "List organization grants for an operator with platform administration access.",
  args: z.object({ orgId: z.string().min(1).describe("Organization whose grants may be viewed") }),
  authorize: (args) => [telemetryRequirement(args.orgId), platformAdminRequirement()],
  load: async (ctx, args) => {
    const source = getPlatformDataSource(ctx);
    await assertPlatformAccess(source, telemetryRequirement(args.orgId), ctx);
    await assertPlatformAccess(source, platformAdminRequirement(), ctx);
    return source.listGrants({ orgId: args.orgId }, ctx);
  },
});

/** Compact text fallback for MCP clients that do not render a View. */
export async function summarizePlatformSnapshot(ctx: KitContext, args: QueryArgs) {
  const snapshot = await getPlatformOverview.load(ctx, args);
  return kit.text([
    `Platform overview for ${args.orgId}`,
    `${snapshot.sessions.length} sessions · ${snapshot.events.length} events · $${snapshot.aggregate.totalEstimatedCostUsd.toFixed(4)} estimated cost`,
    `${snapshot.apps.length} apps · ${snapshot.kits.length} kits · ${snapshot.plugins.length} plugins`,
  ].join("\n"));
}
