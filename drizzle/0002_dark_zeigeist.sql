CREATE TABLE `empire_news_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`news_id` integer NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `empire_news_assets_news_id_unique` ON `empire_news_assets` (`news_id`);