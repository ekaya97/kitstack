CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `authors` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`handle` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text,
	`avatar_url` text,
	`verified` integer DEFAULT false,
	`website` text,
	`location` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authors_handle_unique` ON `authors` (`handle`);--> statement-breakpoint
CREATE TABLE `authz_tuples` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`relation` text NOT NULL,
	`object_type` text NOT NULL,
	`object_id` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authz_tuples_unique_idx` ON `authz_tuples` (`subject_type`,`subject_id`,`relation`,`object_type`,`object_id`);--> statement-breakpoint
CREATE INDEX `authz_tuples_object_idx` ON `authz_tuples` (`object_type`,`object_id`,`relation`);--> statement-breakpoint
CREATE INDEX `authz_tuples_subject_idx` ON `authz_tuples` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE TABLE `kit_activations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kit_slug` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`deactivated_at` integer,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kit_activations_unique_idx` ON `kit_activations` (`user_id`,`kit_slug`);--> statement-breakpoint
CREATE TABLE `kits` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`corresponding_skill_slug` text,
	`replaces` text NOT NULL,
	`savings_per_month` integer NOT NULL,
	`db_schema` text,
	`mcp_tools` text,
	`mcp_apps` text,
	`tagline` text,
	`author` text DEFAULT 'kitstack',
	`status` text DEFAULT 'live',
	`subscriber_count` integer DEFAULT 0,
	`avg_rating` real DEFAULT 0,
	`review_count` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kits_slug_unique` ON `kits` (`slug`);--> statement-breakpoint
CREATE TABLE `review_helpful` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_helpful_unique_idx` ON `review_helpful` (`review_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_slug` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`user_role` text,
	`rating` integer NOT NULL,
	`text` text NOT NULL,
	`verified` integer DEFAULT false,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_user_target_idx` ON `reviews` (`user_id`,`target_type`,`target_slug`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `skill_downloads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`skill_slug` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`upgrade_hook` text,
	`tags` text NOT NULL,
	`compatibility` text NOT NULL,
	`example_input` text NOT NULL,
	`example_output` text NOT NULL,
	`whats_inside` text NOT NULL,
	`composition` text NOT NULL,
	`s3_key` text,
	`download_count` integer DEFAULT 0,
	`author` text DEFAULT 'kitstack',
	`file_size` text,
	`corresponding_kit_slug` text,
	`avg_rating` real DEFAULT 0,
	`review_count` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_slug_unique` ON `skills` (`slug`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`lemonsqueezy_subscription_id` text,
	`current_period_end` integer,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `wishlists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_slug` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wishlists_unique_idx` ON `wishlists` (`user_id`,`target_type`,`target_slug`);