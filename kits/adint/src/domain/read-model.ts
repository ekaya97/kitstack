/**
 * adint read model, ported from ~/dev/adint
 * (src/contexts/presentation/infrastructure/sqlite-dashboard-store.ts). Same SQL — the source is
 * better-sqlite3 (sync); here it runs on drizzle/libSQL (async) via the `sql` template. SQLite
 * dialect is compatible (json_each, CTEs, joins). See .track/docs/adint-domain-reference.md §4.
 */

import { sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { AdGraphObservationRow } from "./ad-graph.js";

export interface GraphPublisherOption {
  readonly domain: string;
  readonly isStroeer: boolean;
}

export interface TriggerTimelineEntry {
  readonly observationId: string;
  readonly observedAt: string;
  readonly publisher: string;
  readonly event: string;
}

export interface TriggerEvidenceLink {
  readonly label: string;
  readonly href: string;
  readonly kind: "screenshot" | "markup" | "payload";
}

export interface TriggerView {
  readonly id: string;
  readonly campaignId: string;
  readonly eventType: string;
  readonly brandId: string;
  readonly brandName: string;
  readonly agencyName: string;
  readonly agencyStatus: string;
  readonly score: number;
  readonly scoreComponents: Readonly<Record<string, number>>;
  readonly live: { readonly lastObservedAt: string; readonly windowDays: number; readonly coverageComplete: true };
  readonly publishers: readonly string[];
  readonly evidence: readonly TriggerEvidenceLink[];
  readonly timeline: readonly TriggerTimelineEntry[];
}

type Row = Record<string, unknown>;

const graphSelect = `
  o.id AS observationId, p.domain AS publisherDomain, p.is_stroeer AS isStroeer,
  o.page_url AS pageUrl, o.slot_id AS slotId, o.is_empty AS isEmpty, o.ad_system AS adSystem,
  o.gam_advertiser_id AS advertiserId, o.gam_campaign_id AS campaignId, o.gam_creative_id AS creativeId,
  o.creative_hash AS creativeHash, o.ts AS observedAt,
  o.screenshot_blob AS screenshotHash, o.markup_blob AS markupHash, o.clickthrough_raw AS clickthrough,
  c.landing_domain AS landingDomain, c.brand_id AS brandId, b.name AS brandName`;

/** Distinct publishers that have observations, with the Ströer flag. */
export async function graphPublishers(db: LibSQLDatabase): Promise<GraphPublisherOption[]> {
  const rows = (await db.all(sql`
    SELECT DISTINCT p.domain AS domain, p.is_stroeer AS isStroeer
    FROM publisher AS p
    JOIN crawl_run AS r ON r.publisher_id = p.id
    JOIN observation AS o ON o.crawl_run_id = r.id
    ORDER BY p.domain
  `)) as Row[];
  return rows.map((row) => ({ domain: String(row.domain), isStroeer: row.isStroeer === 1 }));
}

/** Every publisher's latest run, unioned — the cross-publisher overview. */
export async function graphSliceAll(db: LibSQLDatabase, limit: number): Promise<AdGraphObservationRow[]> {
  const rows = (await db.all(sql`
    WITH latest AS (
      SELECT r.publisher_id AS pid, MAX(r.started_at) AS mx
      FROM crawl_run AS r JOIN observation AS o ON o.crawl_run_id = r.id
      GROUP BY r.publisher_id
    ), runs AS (
      SELECT r.id AS id FROM crawl_run AS r JOIN latest AS l ON l.pid = r.publisher_id AND l.mx = r.started_at
    )
    SELECT ${sql.raw(graphSelect)}
    FROM observation AS o
    JOIN crawl_run AS r ON r.id = o.crawl_run_id
    JOIN publisher AS p ON p.id = r.publisher_id
    LEFT JOIN creative AS c ON c.creative_hash = o.creative_hash
    LEFT JOIN brand AS b ON b.id = c.brand_id
    WHERE o.crawl_run_id IN (SELECT id FROM runs)
    ORDER BY p.domain, o.page_url, o.slot_id
    LIMIT ${Math.max(1, limit)}
  `)) as Row[];
  return rows.map(toGraphRow);
}

/** One publisher's latest run (focus view), or all publishers when `publisher` is undefined. */
export async function graphSlice(
  db: LibSQLDatabase,
  publisher: string | undefined,
  limit: number
): Promise<AdGraphObservationRow[]> {
  if (publisher === undefined) return graphSliceAll(db, limit);
  const run = (await db.get(sql`
    SELECT r.id AS id FROM crawl_run AS r JOIN publisher AS p ON p.id = r.publisher_id
    WHERE p.domain = ${publisher} ORDER BY r.started_at DESC LIMIT 1
  `)) as { id?: string } | undefined;
  if (run?.id === undefined) return [];
  const rows = (await db.all(sql`
    SELECT ${sql.raw(graphSelect)}
    FROM observation AS o
    JOIN crawl_run AS r ON r.id = o.crawl_run_id
    JOIN publisher AS p ON p.id = r.publisher_id
    LEFT JOIN creative AS c ON c.creative_hash = o.creative_hash
    LEFT JOIN brand AS b ON b.id = c.brand_id
    WHERE o.crawl_run_id = ${run.id}
    ORDER BY o.page_url, o.slot_id
    LIMIT ${Math.max(1, limit)}
  `)) as Row[];
  return rows.map(toGraphRow);
}

/** Where and when a brand's creatives were observed. */
export async function brandTimeline(db: LibSQLDatabase, brandId: string): Promise<TriggerTimelineEntry[]> {
  const rows = (await db.all(sql`
    SELECT o.id AS id, o.ts AS ts, p.domain AS domain, o.ad_system AS ad_system
    FROM observation AS o
    JOIN crawl_run AS r ON r.id = o.crawl_run_id
    JOIN publisher AS p ON p.id = r.publisher_id
    JOIN creative AS c ON c.creative_hash = o.creative_hash
    WHERE c.brand_id = ${brandId}
    ORDER BY o.ts, o.id
  `)) as Row[];
  return rows.map((row) => ({
    observationId: String(row.id),
    observedAt: String(row.ts),
    publisher: String(row.domain),
    event: `Observation (${String(row.ad_system)})`,
  }));
}

const triggerQuery = `
  SELECT e.id AS id, e.type AS type, e.campaign_id AS campaign_id, e.score AS score, e.evidence AS evidence,
         c.brand_id AS brand_id, b.name AS brand_name,
         ca.agency_name AS agency_name, ca.status AS agency_status
  FROM event AS e
  JOIN campaign AS c ON c.id = e.campaign_id
  JOIN brand AS b ON b.id = c.brand_id
  LEFT JOIN campaign_agency AS ca ON ca.campaign_id = c.id`;

/** Live triggers, liveness re-checked at read time, sorted by score desc. Empty until the
 *  campaigns/insight pipeline writes `event` rows (domain-reference §3). */
export async function listTriggers(db: LibSQLDatabase): Promise<TriggerView[]> {
  const rows = (await db.all(sql.raw(triggerQuery))) as Row[];
  const views = await Promise.all(rows.map((row) => toTrigger(db, row)));
  return views
    .filter((v): v is TriggerView => v !== null)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export async function findTrigger(db: LibSQLDatabase, id: string): Promise<TriggerView | null> {
  const row = (await db.get(sql`${sql.raw(triggerQuery)} WHERE e.id = ${id}`)) as Row | undefined;
  return row === undefined ? null : toTrigger(db, row);
}

// ---- trigger mapping (ported from sqlite-dashboard-store.ts) ----

interface StoredEvidence {
  readonly screenshotBlobs?: unknown;
  readonly markupBlobs?: unknown;
  readonly payloadBlobs?: unknown;
  readonly publishers?: unknown;
  readonly liveness?: { readonly lastObservedAt?: unknown; readonly live?: unknown; readonly windowDays?: unknown; readonly coverageComplete?: unknown };
  readonly coverage?: { readonly complete?: unknown };
  readonly scoreComponents?: unknown;
  readonly scoring?: { readonly components?: unknown };
}

async function toTrigger(db: LibSQLDatabase, row: Row): Promise<TriggerView | null> {
  if (row.type === "ENDED") return null;
  const evidence = parseEvidence(String(row.evidence ?? "{}"));
  const live = readLiveness(evidence);
  if (live === null) return null;
  const publishers = await publisherDomains(db, strings(evidence.publishers));
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    eventType: String(row.type),
    brandId: String(row.brand_id),
    brandName: String(row.brand_name),
    agencyName: (typeof row.agency_name === "string" ? row.agency_name.trim() : "") || "Unknown",
    agencyStatus: (row.agency_status as string) ?? "unknown",
    score: typeof row.score === "number" ? row.score : 0,
    scoreComponents: numberRecord(evidence.scoring?.components ?? evidence.scoreComponents),
    live,
    publishers,
    evidence: evidenceLinks(evidence),
    timeline: [],
  };
}

function parseEvidence(value: string): StoredEvidence {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === "object" ? (parsed as StoredEvidence) : {};
  } catch {
    return {};
  }
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
function numberRecord(value: unknown): Readonly<Record<string, number>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
  );
}
function readLiveness(evidence: StoredEvidence): TriggerView["live"] | null {
  const liveness = evidence.liveness;
  if (
    !liveness ||
    liveness.live !== true ||
    liveness.coverageComplete !== true ||
    evidence.coverage?.complete !== true ||
    typeof liveness.lastObservedAt !== "string"
  )
    return null;
  return {
    lastObservedAt: liveness.lastObservedAt,
    windowDays:
      typeof liveness.windowDays === "number" && Number.isInteger(liveness.windowDays) && liveness.windowDays > 0
        ? liveness.windowDays
        : 3,
    coverageComplete: true,
  };
}
async function publisherDomains(db: LibSQLDatabase, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = (await db.all(sql`SELECT id, domain FROM publisher WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`)) as Row[];
  const domains = new Map(rows.map((row) => [String(row.id), String(row.domain)]));
  return ids.map((id) => domains.get(id) ?? id);
}
function evidenceLinks(evidence: StoredEvidence): TriggerEvidenceLink[] {
  return [
    ...strings(evidence.screenshotBlobs).map((key) => ({ label: `Screenshot ${key}`, href: `/blob/${key}`, kind: "screenshot" as const })),
    ...strings(evidence.markupBlobs).map((key) => ({ label: `Markup ${key}`, href: `/blob/${key}`, kind: "markup" as const })),
    ...strings(evidence.payloadBlobs).map((key) => ({ label: `Payload ${key}`, href: `/blob/${key}`, kind: "payload" as const })),
  ];
}

function graphString(value: unknown): string | null {
  if (typeof value === "string") return value.length > 0 ? value : null;
  return typeof value === "number" ? String(value) : null;
}
const SHA256 = /^[a-f0-9]{64}$/;
function blobHash(value: unknown): string | null {
  return typeof value === "string" && SHA256.test(value) ? value : null;
}
function toGraphRow(row: Row): AdGraphObservationRow {
  return {
    publisherDomain: String(row.publisherDomain ?? ""),
    isStroeer: row.isStroeer === 1,
    pageUrl: String(row.pageUrl ?? ""),
    observationId: String(row.observationId ?? ""),
    slotId: String(row.slotId ?? ""),
    isEmpty: row.isEmpty === 1,
    adSystem: graphString(row.adSystem),
    advertiserId: graphString(row.advertiserId),
    campaignId: graphString(row.campaignId),
    creativeId: graphString(row.creativeId),
    creativeHash: graphString(row.creativeHash),
    observedAt: String(row.observedAt ?? ""),
    screenshotHash: blobHash(row.screenshotHash),
    markupHash: blobHash(row.markupHash),
    clickthrough: graphString(row.clickthrough),
    landingDomain: graphString(row.landingDomain),
    brandId: graphString(row.brandId),
    brandName: graphString(row.brandName),
  };
}
