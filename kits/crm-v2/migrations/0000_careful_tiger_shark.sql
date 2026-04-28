CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`industry` text,
	`size` text,
	`notes` text,
	`tags` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`first_name` text NOT NULL,
	`last_name` text,
	`email` text,
	`phone` text,
	`role` text,
	`relationship` text DEFAULT 'neutral',
	`source` text,
	`notes` text,
	`tags` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text,
	`company_id` text,
	`title` text NOT NULL,
	`value_cents` integer,
	`currency` text DEFAULT 'EUR',
	`stage` text DEFAULT 'lead',
	`probability` integer,
	`expected_close` text,
	`lost_reason` text,
	`notes` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`type` text NOT NULL,
	`summary` text NOT NULL,
	`sentiment` text,
	`follow_up` text,
	`follow_up_by` text,
	`occurred_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
