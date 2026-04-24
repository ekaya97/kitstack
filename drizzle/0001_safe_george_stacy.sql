CREATE TABLE `kit_registry` (
	`kit_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`tool_description` text NOT NULL,
	`input_schema` text NOT NULL,
	`lambda_arn` text NOT NULL,
	`kit_name` text NOT NULL,
	`kit_description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kit_registry_pk` ON `kit_registry` (`kit_id`,`tool_name`);