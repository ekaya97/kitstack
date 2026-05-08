CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'EUR',
	`vat_rate` integer,
	`net_cents` integer,
	`vat_cents` integer,
	`category` text NOT NULL,
	`subcategory` text,
	`description` text NOT NULL,
	`vendor` text,
	`payment_method` text,
	`is_deductible` integer DEFAULT 1,
	`receipt_note` text,
	`tags` text,
	`expense_date` text NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_date` ON `expenses` (`expense_date`);--> statement-breakpoint
CREATE INDEX `idx_expenses_category` ON `expenses` (`category`);--> statement-breakpoint
CREATE TABLE `income` (
	`id` text PRIMARY KEY NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'EUR',
	`source` text NOT NULL,
	`description` text,
	`invoice_ref` text,
	`payment_method` text,
	`received_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_income_date` ON `income` (`received_date`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`skr03_account` text,
	`parent_category` text,
	`is_default` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
-- Seed default categories (SKR03 mapping)
INSERT INTO `categories` (`id`, `name`, `skr03_account`, `is_default`) VALUES
	('cat_office_supplies', 'office_supplies', '4930', 1),
	('cat_software', 'software', '4964', 1),
	('cat_hardware', 'hardware', '0410', 1),
	('cat_travel', 'travel', '4660', 1),
	('cat_meals_business', 'meals_business', '4650', 1),
	('cat_meals_personal', 'meals_personal', '4680', 1),
	('cat_phone_internet', 'phone_internet', '4920', 1),
	('cat_advertising', 'advertising', '4600', 1),
	('cat_education', 'education', '4945', 1),
	('cat_insurance', 'insurance', '4360', 1),
	('cat_rent', 'rent', '4210', 1),
	('cat_professional_services', 'professional_services', '4900', 1),
	('cat_transport', 'transport', '4670', 1),
	('cat_misc', 'misc', '4900', 1);
--> statement-breakpoint
-- Seed default settings
INSERT INTO `settings` (`key`, `value`) VALUES
	('vat_mode', 'standard'),
	('default_currency', 'EUR'),
	('fiscal_year_start', '01');
