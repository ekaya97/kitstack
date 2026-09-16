import type { AuthzRequirement, KitContext } from "@kitstackco/sdk";

export const PLATFORM_DATA_CONNECTOR = "platform.data";
export const PLATFORM_RESOURCE = "kitstack";

export type PlatformEvent = {
  id: string;
  timestamp: string;
  orgId: string;
  appId: string | null;
  sessionId?: string | null;
  parentId?: string | null;
  traceId?: string | null;
  channel: string;
  pluginId?: string | null;
  kitId?: string | null;
  type: string;
  operation: string;
  model?: string | null;
  provider?: string | null;
  requestTokens?: number | null;
  responseTokens?: number | null;
  latencyMs?: number | null;
  estimatedCostUsd?: number | null;
  outcome: string;
};

export type PlatformAggregate = {
  totalEvents: number;
  totalRequestTokens: number;
  totalResponseTokens: number;
  totalEstimatedCostUsd: number;
  totalLatencyMs: number;
  successCount: number;
  errorCount: number;
  byApp?: PlatformAggregateDimension[];
  byType?: PlatformAggregateDimension[];
  byChannel?: PlatformAggregateDimension[];
};

export type PlatformAggregateDimension = {
  key: string | null;
  eventCount: number;
  requestTokens: number;
  responseTokens: number;
  estimatedCostUsd: number;
};

export type PlatformApp = { id: string; name: string; org: string; scopes: string[]; createdAt: string };
export type PlatformKit = { id: string; version: string; status: string };
export type PlatformPlugin = { id: string; kind: string; version: string; status: string };
export type PlatformProvider = { provider: string; status: string; eventCount: number; errorCount: number; lastEventAt: string | null };
export type PlatformSession = { sessionId: string; appId: string | null; kitId: string | null; state: string; lastEventAt: string | null };

export type PlatformGrant = {
  subjectType: string;
  subjectId: string;
  relation: string;
  objectType: string;
  objectId: string;
};

export type PlatformQuery = {
  orgId: string;
  appId?: string | null;
  teamId?: string;
  kitId?: string;
  pluginId?: string;
  sessionId?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export type PlatformSnapshot = {
  events: PlatformEvent[];
  aggregate: PlatformAggregate;
  apps: PlatformApp[];
  kits: PlatformKit[];
  plugins: PlatformPlugin[];
  sessions: PlatformSession[];
  providerHealth: PlatformProvider[];
};

/**
 * Host boundary for the platform kit. Implementations must scope reads by
 * `query.orgId` and `ctx.identity`; callers cannot use View parameters to
 * expand their organization or team scope.
 */
export interface PlatformDataSource {
  authorize(requirement: AuthzRequirement, ctx: KitContext): Promise<boolean>;
  snapshot(query: PlatformQuery, ctx: KitContext): Promise<PlatformSnapshot>;
  listGrants(query: Pick<PlatformQuery, "orgId">, ctx: KitContext): Promise<PlatformGrant[]>;
}

export type PlatformDataReaders = {
  telemetry: {
    query(query: PlatformQuery, ctx: KitContext): Promise<PlatformEvent[]>;
    aggregate(query: PlatformQuery, ctx: KitContext): Promise<PlatformAggregate>;
  };
  registry: {
    apps(orgId: string, ctx: KitContext): Promise<PlatformApp[]> | PlatformApp[];
    kits(orgId: string, ctx: KitContext): Promise<PlatformKit[]> | PlatformKit[];
    plugins(orgId: string, ctx: KitContext): Promise<PlatformPlugin[]> | PlatformPlugin[];
    sessions?(query: PlatformQuery, ctx: KitContext): Promise<PlatformSession[]> | PlatformSession[];
    providerHealth?(query: PlatformQuery, ctx: KitContext): Promise<PlatformProvider[]> | PlatformProvider[];
  };
  grants: {
    check(requirement: AuthzRequirement, ctx: KitContext): Promise<boolean>;
    list(orgId: string, ctx: KitContext): Promise<PlatformGrant[]>;
  };
};

/** Adapt the existing telemetry, registry, and authz stores to the kit seam. */
export function createPlatformDataSource(readers: PlatformDataReaders): PlatformDataSource {
  return {
    authorize: (requirement, ctx) => readers.grants.check(requirement, ctx),
    async snapshot(query, ctx) {
      // The readers own the actual SQL and must enforce the context scope.
      const [events, aggregate, apps, kits, plugins] = await Promise.all([
        readers.telemetry.query(query, ctx),
        readers.telemetry.aggregate(query, ctx),
        readers.registry.apps(query.orgId, ctx),
        readers.registry.kits(query.orgId, ctx),
        readers.registry.plugins(query.orgId, ctx),
      ]);
      const [sessions, providerHealth] = await Promise.all([
        readers.registry.sessions?.(query, ctx) ?? [],
        readers.registry.providerHealth?.(query, ctx) ?? [],
      ]);
      void ctx;
      return { events, aggregate, apps, kits, plugins, sessions, providerHealth };
    },
    listGrants: (query, ctx) => readers.grants.list(query.orgId, ctx),
  };
}

export function telemetryRequirement(orgId: string): AuthzRequirement {
  return { relation: "kit:telemetry", objectType: "organization", objectId: orgId };
}

export function platformAdminRequirement(): AuthzRequirement {
  return { relation: "platform:admin", objectType: "platform", objectId: PLATFORM_RESOURCE };
}

export function getPlatformDataSource(ctx: KitContext): PlatformDataSource {
  return ctx.connectors.require<PlatformDataSource>(PLATFORM_DATA_CONNECTOR);
}

export async function assertPlatformAccess(
  source: PlatformDataSource,
  requirement: AuthzRequirement,
  ctx: KitContext,
): Promise<void> {
  if (!(await source.authorize(requirement, ctx))) {
    throw new Error("Forbidden: platform kit access requires an applicable grant");
  }
}

export function orgIdFromParams(ctx: KitContext): string {
  const orgId = ctx.params.orgId;
  if (typeof orgId !== "string" || orgId.trim() === "") {
    throw new Error("Platform View requires params.orgId");
  }
  return orgId;
}
