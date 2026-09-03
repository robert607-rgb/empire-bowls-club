CREATE TABLE `empire_sponsors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`website` text NOT NULL,
	`logo_object_key` text NOT NULL,
	`logo_file_name` text NOT NULL,
	`logo_content_type` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `empire_fixtures` ADD `result_text` text;