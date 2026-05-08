CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`context` text NOT NULL,
	`options_considered` text,
	`decision` text NOT NULL,
	`reasoning` text NOT NULL,
	`confidence` text,
	`urgency` text,
	`category` text,
	`reversibility` text,
	`stakes` text,
	`tags` text,
	`decided_at` text NOT NULL,
	`review_date` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_decisions_category` ON `decisions` (`category`);--> statement-breakpoint
CREATE INDEX `idx_decisions_decided_at` ON `decisions` (`decided_at`);--> statement-breakpoint
CREATE INDEX `idx_decisions_review_date` ON `decisions` (`review_date`);--> statement-breakpoint
CREATE TABLE `outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`decision_id` text NOT NULL,
	`outcome` text NOT NULL,
	`assessment` text,
	`what_i_learned` text,
	`would_decide_differently` integer,
	`recorded_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`decision_id`) REFERENCES `decisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_outcomes_decision` ON `outcomes` (`decision_id`);--> statement-breakpoint
CREATE INDEX `idx_outcomes_assessment` ON `outcomes` (`assessment`);--> statement-breakpoint
CREATE TABLE `principles` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`derived_from` text,
	`times_referenced` integer DEFAULT 0,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
