CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text,
	`deal_id` text,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`company` text,
	`email` text,
	`phone` text,
	`source` text,
	`notes` text,
	`last_contacted_at` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact_id` text,
	`value` real,
	`currency` text DEFAULT 'EUR',
	`stage` text DEFAULT 'prospect' NOT NULL,
	`notes` text,
	`expected_close_date` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text,
	`content` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action
);
