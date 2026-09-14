import { sqliteTable, text, integer, real, index, blob } from "drizzle-orm/sqlite-core";

/**
 * adint read model — mirrors the read-relevant tables of the standalone adint SQLite store
 * (~/dev/adint). See .track/docs/adint-domain-reference.md §3. Stage A reads these; the pipeline
 * that fills them (capture/resolution/campaigns/insight) is Stage B.
 *
 * Reads are done via raw SQL (drizzle `sql` template) in src/domain/read-model.ts because the
 * queries are join/CTE/json_each heavy and port verbatim from adint. These table objects exist
 * for defineKit's schema contract and for future typed writes (the enrichment agent).
 */

export const publisher = sqliteTable("publisher", {
  id: text("id").primaryKey(),
  domain: text("domain").notNull(),
  salesHouse: text("sales_house"),
  isStroeer: integer("is_stroeer").notNull().default(0),
  sectionUrls: text("section_urls").notNull().default("[]"),
});

export const crawlRun = sqliteTable(
  "crawl_run",
  {
    id: text("id").primaryKey(),
    publisherId: text("publisher_id").notNull(),
    profile: text("profile").notNull(),
    startedAt: text("started_at").notNull(),
    status: text("status").notNull(),
    pages: integer("pages").notNull().default(0),
    finishedAt: text("finished_at"),
    bytesDownloaded: integer("bytes_downloaded").notNull().default(0),
  },
  (t) => [index("idx_crawl_run_publisher").on(t.publisherId, t.startedAt)]
);

export const observation = sqliteTable(
  "observation",
  {
    id: integer("id").primaryKey(),
    crawlRunId: text("crawl_run_id").notNull(),
    ts: text("ts").notNull(),
    pageUrl: text("page_url").notNull(),
    slotId: text("slot_id").notNull(),
    adSystem: text("ad_system").notNull(),
    gamAdvertiserId: text("gam_advertiser_id"),
    gamCampaignId: text("gam_campaign_id"),
    gamCreativeId: text("gam_creative_id"),
    creativeHash: text("creative_hash"),
    clickthroughRaw: text("clickthrough_raw"),
    screenshotBlob: text("screenshot_blob"),
    markupBlob: text("markup_blob"),
    payloadBlob: text("payload_blob"),
    isEmpty: integer("is_empty").notNull().default(0),
    sourceKey: text("source_key").notNull().default(""),
  },
  (t) => [index("idx_observation_run").on(t.crawlRunId), index("idx_observation_creative").on(t.creativeHash)]
);

export const creative = sqliteTable(
  "creative",
  {
    creativeHash: text("creative_hash").primaryKey(),
    firstSeen: text("first_seen").notNull(),
    lastSeen: text("last_seen").notNull(),
    phash: text("phash"),
    embedding: blob("embedding"),
    assets: text("assets").notNull().default("[]"),
    clickthroughRaw: text("clickthrough_raw"),
    landingDomain: text("landing_domain"),
    brandId: text("brand_id"),
    ocrText: text("ocr_text"),
  },
  (t) => [index("idx_creative_brand").on(t.brandId)]
);

export const brand = sqliteTable("brand", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  parent: text("parent"),
  landingDomains: text("landing_domains").notNull().default("[]"),
  vertical: text("vertical"),
  cm360Networks: text("cm360_networks").notNull().default("[]"),
  status: text("status").notNull().default("auto"),
});

// Trigger layer (Stage B+ pipeline output). Empty on current data.
export const campaign = sqliteTable("campaign", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull(),
  firstSeen: text("first_seen").notNull(),
  lastSeen: text("last_seen").notNull(),
  creativeHashes: text("creative_hashes").notNull().default("[]"),
  publishers: text("publishers").notNull().default("[]"),
  adSystems: text("ad_systems").notNull().default("[]"),
  campaignType: text("campaign_type"),
});

export const event = sqliteTable("event", {
  id: text("id").primaryKey(),
  ts: text("ts").notNull(),
  type: text("type").notNull(),
  campaignId: text("campaign_id").notNull(),
  publisherId: text("publisher_id"),
  score: real("score"),
  evidence: text("evidence").notNull().default("{}"),
});

export const campaignAgency = sqliteTable("campaign_agency", {
  campaignId: text("campaign_id").primaryKey(),
  brandId: text("brand_id").notNull(),
  agencyId: text("agency_id"),
  agencyName: text("agency_name").notNull(),
  status: text("status").notNull(),
  evidence: text("evidence").notNull().default("{}"),
  resolvedAt: text("resolved_at").notNull(),
});

export const agency = sqliteTable("agency", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
});

export const schema = {
  publisher,
  crawlRun,
  observation,
  creative,
  brand,
  campaign,
  event,
  campaignAgency,
  agency,
};
