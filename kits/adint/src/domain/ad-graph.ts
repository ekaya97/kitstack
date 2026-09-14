/**
 * Pure builder for the ad-intelligence graph view. Copied verbatim from ~/dev/adint
 * (src/contexts/presentation/domain/ad-graph.ts) — only the scrub import path changed. No I/O.
 *
 * Layered left-to-right: publisher → page → slot → advertiser → campaign → creative → brand.
 * The cross-publisher reach of brand/creative identities is the product's core signal:
 *   - crossPublisher: a buyer seen on >= 2 publishers
 *   - notOnStroeer:   a buyer seen on >= 1 competitor and NO Ströer publisher (the opportunity)
 * See .track/docs/adint-domain-reference.md §4.2.
 */

import { redactSensitiveTokens } from "./scrub.js";

export type AdGraphNodeType =
  | "publisher"
  | "page"
  | "slot"
  | "advertiser"
  | "campaign"
  | "creative"
  | "brand";

export const NODE_LAYER: Readonly<Record<AdGraphNodeType, number>> = {
  publisher: 0,
  page: 1,
  slot: 2,
  advertiser: 3,
  campaign: 4,
  creative: 5,
  brand: 6,
};

/** Id namespace for synthetic overlay entities (adint ADR-0016; becomes a grant on KitStack). */
const DEMO_MARK = "demo:";
const isDemo = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.startsWith(DEMO_MARK);

export interface AdGraphEvidence {
  readonly kind: "screenshot" | "markup";
  /** Content-addressed blob route, /blob/<sha256>. No blob server in Stage A — links inert. */
  readonly href: string;
}

export interface AdGraphNode {
  readonly id: string;
  readonly type: AdGraphNodeType;
  readonly label: string;
  readonly layer: number;
  readonly empty?: boolean;
  readonly stroeer?: boolean;
  readonly demo?: boolean;
  readonly reach?: number;
  readonly notOnStroeer?: boolean;
  readonly meta: Readonly<Record<string, string>>;
  readonly evidence: readonly AdGraphEvidence[];
}

export interface AdGraphEdge {
  readonly source: string;
  readonly target: string;
}

export interface AdGraphStats {
  readonly publishers: number;
  readonly pages: number;
  readonly slots: number;
  readonly filledSlots: number;
  readonly emptySlots: number;
  readonly fillRate: number;
  readonly advertisers: number;
  readonly campaigns: number;
  readonly creatives: number;
  readonly creativesWithBrand: number;
  readonly crossPublisher: number;
  readonly notOnStroeer: number;
}

export interface AdGraphViewModel {
  readonly nodes: readonly AdGraphNode[];
  readonly edges: readonly AdGraphEdge[];
  readonly stats: AdGraphStats;
  readonly truncated: boolean;
}

/** One capture observation joined with its optional resolution (brand) layer. */
export interface AdGraphObservationRow {
  readonly publisherDomain: string;
  readonly isStroeer: boolean;
  readonly pageUrl: string;
  readonly observationId: string;
  readonly slotId: string;
  readonly isEmpty: boolean;
  readonly adSystem: string | null;
  readonly advertiserId: string | null;
  readonly campaignId: string | null;
  readonly creativeId: string | null;
  readonly creativeHash: string | null;
  readonly observedAt: string;
  readonly screenshotHash: string | null;
  readonly markupHash: string | null;
  readonly clickthrough: string | null;
  readonly landingDomain?: string | null;
  readonly brandId?: string | null;
  readonly brandName?: string | null;
  readonly brandOnStroeer?: boolean;
}

export interface AdGraphInput {
  readonly rows: readonly AdGraphObservationRow[];
  readonly limit: number;
  readonly collapsePages?: boolean;
}

function shortHash(hash: string): string {
  return hash.length > 10 ? `${hash.slice(0, 10)}…` : hash;
}

function pageLabel(pageUrl: string): string {
  try {
    const path = new URL(pageUrl).pathname.replace(/\/$/, "");
    return path === "" ? "/" : path;
  } catch {
    return pageUrl;
  }
}

export function buildAdGraph(input: AdGraphInput): AdGraphViewModel {
  const nodes = new Map<string, AdGraphNode>();
  const edgeKeys = new Set<string>();
  const edges: AdGraphEdge[] = [];
  let truncated = false;

  const put = (node: AdGraphNode): void => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  };
  const link = (source: string, target: string): void => {
    const key = `${source} ${target}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ source, target });
  };

  const collapse = input.collapsePages === true;
  for (const row of input.rows) {
    const candidateIds = [
      `publisher:${row.publisherDomain}`,
      ...(collapse ? [] : [`page:${row.publisherDomain} ${row.pageUrl}`, `slot:${row.observationId}`]),
      ...(row.advertiserId ? [`advertiser:${row.advertiserId}`] : []),
      ...(row.campaignId ? [`campaign:${row.campaignId}`] : []),
      ...(row.creativeHash ? [`creative:${row.creativeHash}`] : []),
      ...(row.brandId ? [`brand:${row.brandId}`] : []),
    ];
    const newCount = candidateIds.filter((id) => !nodes.has(id)).length;
    if (nodes.size + newCount > input.limit) {
      truncated = true;
      continue;
    }

    const publisherId = `publisher:${row.publisherDomain}`;
    put({
      id: publisherId,
      type: "publisher",
      label: row.publisherDomain,
      layer: NODE_LAYER.publisher,
      ...(row.isStroeer ? { stroeer: true } : {}),
      meta: { domain: row.publisherDomain, stroeer: String(row.isStroeer) },
      evidence: [],
    });

    const slotEvidence: AdGraphEvidence[] = [
      ...(row.screenshotHash ? [{ kind: "screenshot" as const, href: `/blob/${row.screenshotHash}` }] : []),
      ...(row.markupHash ? [{ kind: "markup" as const, href: `/blob/${row.markupHash}` }] : []),
    ];
    let tail = publisherId;
    if (!collapse) {
      const pageId = `page:${row.publisherDomain} ${row.pageUrl}`;
      put({ id: pageId, type: "page", label: pageLabel(row.pageUrl), layer: NODE_LAYER.page, meta: { url: row.pageUrl }, evidence: [] });
      link(publisherId, pageId);
      const slotId = `slot:${row.observationId}`;
      put({
        id: slotId,
        type: "slot",
        label: row.slotId || row.observationId,
        layer: NODE_LAYER.slot,
        empty: row.isEmpty,
        meta: {
          page: row.pageUrl,
          slot: row.slotId,
          empty: String(row.isEmpty),
          observedAt: row.observedAt,
          ...(row.adSystem ? { adSystem: row.adSystem } : {}),
          ...(row.advertiserId ? { advertiserId: row.advertiserId } : {}),
          ...(row.campaignId ? { campaignId: row.campaignId } : {}),
          ...(row.creativeId ? { creativeId: row.creativeId } : {}),
          ...(row.clickthrough ? { clickthrough: row.clickthrough } : {}),
        },
        evidence: slotEvidence,
      });
      link(pageId, slotId);
      tail = slotId;
    }
    if (row.advertiserId) {
      const advertiserId = `advertiser:${row.advertiserId}`;
      put({ id: advertiserId, type: "advertiser", label: row.advertiserId, layer: NODE_LAYER.advertiser, ...(isDemo(row.advertiserId) ? { demo: true } : {}), meta: { gamAdvertiserId: row.advertiserId }, evidence: [] });
      link(tail, advertiserId);
      tail = advertiserId;
    }
    if (row.campaignId) {
      const campaignId = `campaign:${row.campaignId}`;
      put({ id: campaignId, type: "campaign", label: row.campaignId, layer: NODE_LAYER.campaign, ...(isDemo(row.campaignId) ? { demo: true } : {}), meta: { gamCampaignId: row.campaignId }, evidence: [] });
      link(tail, campaignId);
      tail = campaignId;
    }
    if (row.creativeHash) {
      const creativeId = `creative:${row.creativeHash}`;
      put({
        id: creativeId,
        type: "creative",
        label: shortHash(row.creativeHash),
        layer: NODE_LAYER.creative,
        ...(isDemo(row.creativeHash) ? { demo: true } : {}),
        meta: {
          creativeHash: row.creativeHash,
          ...(row.clickthrough ? { clickthrough: row.clickthrough } : {}),
          ...(row.landingDomain ? { landingDomain: row.landingDomain } : {}),
        },
        evidence: slotEvidence,
      });
      link(tail, creativeId);
      tail = creativeId;

      if (row.brandId) {
        const brandId = `brand:${row.brandId}`;
        put({
          id: brandId,
          type: "brand",
          label: row.brandName ?? row.brandId,
          layer: NODE_LAYER.brand,
          ...(row.brandOnStroeer ? { stroeer: true } : {}),
          ...(isDemo(row.brandId) ? { demo: true } : {}),
          meta: { brandId: row.brandId, ...(row.brandName ? { name: row.brandName } : {}) },
          evidence: [],
        });
        link(creativeId, brandId);
      }
    }
  }

  const reach = computeReach(input.rows);

  const scrubbedNodes = [...nodes.values()].map((node) => {
    const r = reach.get(node.id);
    const isBuyer =
      node.type === "advertiser" || node.type === "campaign" || node.type === "creative" || node.type === "brand";
    const opportunity =
      (node.type === "creative" || node.type === "brand") && r !== undefined && r.publishers.size >= 1 && !r.stroeer;
    return {
      ...node,
      label: redactSensitiveTokens(node.label),
      meta: Object.fromEntries(Object.entries(node.meta).map(([key, value]) => [key, redactSensitiveTokens(value)])),
      ...(isBuyer && r ? { reach: r.publishers.size } : {}),
      ...(opportunity ? { notOnStroeer: true } : {}),
    };
  });
  return { nodes: scrubbedNodes, edges, stats: computeStats(input.rows, nodes, reach), truncated };
}

interface Reach {
  readonly publishers: Set<string>;
  stroeer: boolean;
}

function computeReach(rows: readonly AdGraphObservationRow[]): Map<string, Reach> {
  const reach = new Map<string, Reach>();
  const add = (id: string, domain: string, stroeer: boolean): void => {
    const entry = reach.get(id) ?? { publishers: new Set<string>(), stroeer: false };
    entry.publishers.add(domain);
    if (stroeer) entry.stroeer = true;
    reach.set(id, entry);
  };
  for (const row of rows) {
    if (row.advertiserId) add(`advertiser:${row.advertiserId}`, row.publisherDomain, row.isStroeer);
    if (row.campaignId) add(`campaign:${row.campaignId}`, row.publisherDomain, row.isStroeer);
    if (row.creativeHash) add(`creative:${row.creativeHash}`, row.publisherDomain, row.isStroeer);
    if (row.brandId) add(`brand:${row.brandId}`, row.publisherDomain, row.isStroeer);
  }
  return reach;
}

function computeStats(
  rows: readonly AdGraphObservationRow[],
  nodes: ReadonlyMap<string, AdGraphNode>,
  reach: ReadonlyMap<string, Reach>
): AdGraphStats {
  const included = (prefix: string): number => [...nodes.keys()].filter((id) => id.startsWith(prefix)).length;
  const slots = rows.length;
  const filledSlots = rows.filter((row) => !row.isEmpty).length;
  const emptySlots = rows.filter((row) => row.isEmpty).length;
  const creativeBrands = new Set(rows.filter((row) => row.creativeHash && row.brandId).map((row) => row.creativeHash));
  const buyerReaches = [...reach.entries()].filter(
    ([id]) => nodes.has(id) && (id.startsWith("creative:") || id.startsWith("brand:"))
  );
  const crossPublisher = buyerReaches.filter(([, r]) => r.publishers.size >= 2).length;
  const notOnStroeer = buyerReaches.filter(([, r]) => r.publishers.size >= 1 && !r.stroeer).length;
  return {
    publishers: included("publisher:"),
    pages: included("page:"),
    slots,
    filledSlots,
    emptySlots,
    fillRate: slots === 0 ? 0 : filledSlots / slots,
    advertisers: included("advertiser:"),
    campaigns: included("campaign:"),
    creatives: included("creative:"),
    creativesWithBrand: creativeBrands.size,
    crossPublisher,
    notOnStroeer,
  };
}
