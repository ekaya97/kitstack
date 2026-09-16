/**
 * Binds the first-party platform kit to the deployed MCP host.
 *
 * The platform kit owns the dashboard contract. This module owns the cloud
 * readers: telemetry comes from the existing debrief service observability
 * endpoint, registry metadata comes from the router registry, and grants are
 * checked/read through the router's authz store. No dashboard code is
 * duplicated here.
 */

import { eq } from "drizzle-orm";
import type { KitContext } from "../../../sdk/src/types";
import {
  createPlatformDataSource,
  type PlatformAggregate,
  type PlatformApp,
  type PlatformDataSource,
  type PlatformEvent,
  type PlatformGrant,
  type PlatformKit,
  type PlatformPlugin,
  type PlatformProvider,
  type PlatformQuery,
  type PlatformSession,
} from "../../../../kits/platform/src/plugins/platform-data";
import { getAllRegistryItems } from "../db/dynamo";
import { authzTuples } from "../../../authz/src/schema";
import { getTursoDb, mcpCheckTuple } from "./authz";
import { demoInternalSecret, demoVoiceServiceUrl } from "../config";

export interface PlatformHostOptions {
  /** Optional test or alternate host reader for the existing telemetry API. */
  fetch?: typeof globalThis.fetch;
  voiceServiceUrl?: string;
  voiceInternalSecret?: Uint8Array;
  getRegistryItems?: typeof getAllRegistryItems;
  checkTuple?: typeof mcpCheckTuple;
  getAuthzDb?: typeof getTursoDb;
}

interface ObservabilityResponse {
  events?: PlatformEvent[];
  aggregate?: PlatformAggregate;
  apps?: PlatformApp[];
  kits?: PlatformKit[];
  plugins?: PlatformPlugin[];
  sessions?: PlatformSession[];
  providerHealth?: PlatformProvider[];
}

/**
 * Create the router's concrete platform source. The source is request scoped
 * by the platform kit's `KitContext`; the short-lived response cache only
 * deduplicates readers within one request/session.
 */
export function createRouterPlatformDataSource(options: PlatformHostOptions = {}): PlatformDataSource {
  const fetcher = options.fetch ?? globalThis.fetch;
  const sourceUrl = (options.voiceServiceUrl ?? demoVoiceServiceUrl()).replace(/\/$/, "");
  const secret = options.voiceInternalSecret ?? demoInternalSecret();
  const registryReader = options.getRegistryItems ?? getAllRegistryItems;
  const checkTuple = options.checkTuple ?? mcpCheckTuple;
  const authzDb = options.getAuthzDb ?? getTursoDb;
  const responseCache = new Map<string, Promise<ObservabilityResponse>>();

  const observability = (query: PlatformQuery, ctx: KitContext): Promise<ObservabilityResponse> => {
    const key = `${ctx.session.id}:${JSON.stringify(query)}`;
    const cached = responseCache.get(key);
    if (cached) return cached;

    const request = readObservability({
      query,
      identity: ctx.identity.principal,
      fetcher,
      sourceUrl,
      secret,
    });
    responseCache.set(key, request);
    return request;
  };

  return createPlatformDataSource({
    telemetry: {
      query: async (query, ctx) => (await observability(query, ctx)).events ?? [],
      aggregate: async (query, ctx) => (await observability(query, ctx)).aggregate ?? emptyAggregate(),
    },
    registry: {
      apps: async (orgId, ctx) => (await observability({ orgId }, ctx)).apps ?? [],
      kits: async (orgId, ctx) => {
        const response = await observability({ orgId }, ctx);
        if (response.kits?.length) return response.kits;
        return registryKits(await registryReader(), orgId);
      },
      plugins: async (orgId, ctx) => (await observability({ orgId }, ctx)).plugins ?? [],
      sessions: async (query, ctx) => (await observability(query, ctx)).sessions ?? [],
      providerHealth: async (query, ctx) => (await observability(query, ctx)).providerHealth ?? [],
    },
    grants: {
      check: async (requirement, ctx) => checkTuple(
        ctx.identity.principal,
        requirement.relation as Parameters<typeof mcpCheckTuple>[1],
        requirement.objectType as Parameters<typeof mcpCheckTuple>[2],
        requirement.objectId,
        "user",
      ),
      list: async (orgId) => {
        const rows = await authzDb()
          .select()
          .from(authzTuples)
          .where(eq(authzTuples.objectId, orgId));
        return rows.map((row): PlatformGrant => ({
          subjectType: row.subjectType,
          subjectId: row.subjectId,
          relation: row.relation,
          objectType: row.objectType,
          objectId: row.objectId,
        }));
      },
    },
  });
}

async function readObservability(input: {
  query: PlatformQuery;
  identity: string;
  fetcher: typeof globalThis.fetch;
  sourceUrl: string;
  secret: Uint8Array;
}): Promise<ObservabilityResponse> {
  if (!input.sourceUrl || !input.fetcher) {
    throw new Error("Platform telemetry source is not configured");
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input.query)) {
    if (value !== undefined && value !== null) params.set(toQueryKey(key), String(value));
  }
  const response = await input.fetcher(`${input.sourceUrl}/api/demo/observability?${params}`, {
    headers: {
      ...(input.secret.byteLength >= 32 ? { "x-kitstack-internal": "platform-reader" } : {}),
      "x-kitstack-principal": input.identity,
    },
  });
  if (!response.ok) throw new Error(`Platform telemetry reader returned HTTP ${response.status}`);
  const body = await response.json() as ObservabilityResponse;
  return body ?? {};
}

function registryKits(items: Awaited<ReturnType<typeof getAllRegistryItems>>, _orgId: string): PlatformKit[] {
  const seen = new Set<string>();
  return items
    .filter((item) => item.kitId !== "debrief" && !item.toolName.startsWith("kitstack_"))
    .filter((item) => {
      if (seen.has(item.kitId)) return false;
      seen.add(item.kitId);
      return true;
    })
    .map((item) => ({ id: item.kitId, version: "registry", status: "ready" }));
}

function toQueryKey(key: string): string {
  // The existing debrief observability route is a JS-facing API and accepts
  // the same camelCase filters as PlatformQuery.
  return key;
}

function emptyAggregate(): PlatformAggregate {
  return {
    totalEvents: 0,
    totalRequestTokens: 0,
    totalResponseTokens: 0,
    totalEstimatedCostUsd: 0,
    totalLatencyMs: 0,
    successCount: 0,
    errorCount: 0,
  };
}
