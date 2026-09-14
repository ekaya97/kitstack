CREATE TABLE `basket_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`unit_price` real NOT NULL,
	`name` text NOT NULL,
	`image` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_basket_user` ON `basket_lines` (`user_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`store` text NOT NULL,
	`pickup_window` text NOT NULL,
	`subtotal` real NOT NULL,
	`friends_points` integer DEFAULT 0 NOT NULL,
	`lines` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_orders_user` ON `orders` (`user_id`);--> statement-breakpoint
CREATE TABLE `pet_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`species` text NOT NULL,
	`breed` text,
	`age_years` real,
	`weight_kg` real,
	`needs` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pet_profile_user` ON `pet_profile` (`user_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brand` text NOT NULL,
	`price_amount` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`price_per_kg` real,
	`image` text NOT NULL,
	`url` text NOT NULL,
	`rating_value` real,
	`rating_count` integer,
	`category` text,
	`species` text,
	`breed_size` text,
	`life_stage` text,
	`food_type` text,
	`grain_free` integer DEFAULT 0,
	`weight` text,
	`badges` text,
	`description` text,
	`bullets` text,
	`composition` text,
	`analytics` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_products_species` ON `products` (`species`);--> statement-breakpoint
CREATE INDEX `idx_products_food_type` ON `products` (`food_type`);--> statement-breakpoint
CREATE INDEX `idx_products_breed_size` ON `products` (`breed_size`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`rating` integer NOT NULL,
	`title` text,
	`text` text NOT NULL,
	`date` text NOT NULL,
	`author` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_product` ON `reviews` (`product_id`);--> statement-breakpoint
CREATE TABLE `ui_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_search_ids` text,
	`last_search_label` text,
	`current_product_id` text,
	`updated_at` text NOT NULL
);
