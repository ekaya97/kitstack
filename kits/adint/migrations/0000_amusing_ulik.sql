CREATE TABLE `agency` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `brand` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent` text,
	`landing_domains` text DEFAULT '[]' NOT NULL,
	`vertical` text,
	`cm360_networks` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'auto' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `campaign` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL,
	`creative_hashes` text DEFAULT '[]' NOT NULL,
	`publishers` text DEFAULT '[]' NOT NULL,
	`ad_systems` text DEFAULT '[]' NOT NULL,
	`campaign_type` text
);
--> statement-breakpoint
CREATE TABLE `campaign_agency` (
	`campaign_id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`agency_id` text,
	`agency_name` text NOT NULL,
	`status` text NOT NULL,
	`evidence` text DEFAULT '{}' NOT NULL,
	`resolved_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crawl_run` (
	`id` text PRIMARY KEY NOT NULL,
	`publisher_id` text NOT NULL,
	`profile` text NOT NULL,
	`started_at` text NOT NULL,
	`status` text NOT NULL,
	`pages` integer DEFAULT 0 NOT NULL,
	`finished_at` text,
	`bytes_downloaded` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_crawl_run_publisher` ON `crawl_run` (`publisher_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `creative` (
	`creative_hash` text PRIMARY KEY NOT NULL,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL,
	`phash` text,
	`embedding` blob,
	`assets` text DEFAULT '[]' NOT NULL,
	`clickthrough_raw` text,
	`landing_domain` text,
	`brand_id` text,
	`ocr_text` text
);
--> statement-breakpoint
CREATE INDEX `idx_creative_brand` ON `creative` (`brand_id`);--> statement-breakpoint
CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`ts` text NOT NULL,
	`type` text NOT NULL,
	`campaign_id` text NOT NULL,
	`publisher_id` text,
	`score` real,
	`evidence` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `observation` (
	`id` integer PRIMARY KEY NOT NULL,
	`crawl_run_id` text NOT NULL,
	`ts` text NOT NULL,
	`page_url` text NOT NULL,
	`slot_id` text NOT NULL,
	`ad_system` text NOT NULL,
	`gam_advertiser_id` text,
	`gam_campaign_id` text,
	`gam_creative_id` text,
	`creative_hash` text,
	`clickthrough_raw` text,
	`screenshot_blob` text,
	`markup_blob` text,
	`payload_blob` text,
	`is_empty` integer DEFAULT 0 NOT NULL,
	`source_key` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_observation_run` ON `observation` (`crawl_run_id`);--> statement-breakpoint
CREATE INDEX `idx_observation_creative` ON `observation` (`creative_hash`);--> statement-breakpoint
CREATE TABLE `publisher` (
	`id` text PRIMARY KEY NOT NULL,
	`domain` text NOT NULL,
	`sales_house` text,
	`is_stroeer` integer DEFAULT 0 NOT NULL,
	`section_urls` text DEFAULT '[]' NOT NULL
);
