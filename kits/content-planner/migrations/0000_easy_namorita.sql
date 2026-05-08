CREATE TABLE `content` (
	`id` text PRIMARY KEY NOT NULL,
	`idea_id` text,
	`title` text NOT NULL,
	`body` text,
	`channel` text NOT NULL,
	`format` text,
	`status` text DEFAULT 'draft',
	`scheduled_date` text,
	`published_date` text,
	`published_url` text,
	`notes` text,
	`tags` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_content_channel` ON `content` (`channel`);--> statement-breakpoint
CREATE INDEX `idx_content_status` ON `content` (`status`);--> statement-breakpoint
CREATE INDEX `idx_content_published` ON `content` (`published_date`);--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`topic` text,
	`target_channel` text,
	`inspiration` text,
	`priority` text DEFAULT 'medium',
	`status` text DEFAULT 'captured',
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ideas_status` ON `ideas` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ideas_topic` ON `ideas` (`topic`);--> statement-breakpoint
CREATE TABLE `performance` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text NOT NULL,
	`impressions` integer,
	`engagements` integer,
	`likes` integer,
	`comments` integer,
	`shares` integer,
	`clicks` integer,
	`notes` text,
	`recorded_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`content_id`) REFERENCES `content`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_performance_content` ON `performance` (`content_id`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`content_count` integer DEFAULT 0,
	`last_used_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_name_unique` ON `topics` (`name`);