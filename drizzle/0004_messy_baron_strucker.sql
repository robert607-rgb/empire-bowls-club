CREATE TABLE `empire_team_sheets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`opponent` text NOT NULL,
	`competition` text NOT NULL,
	`match_date` text NOT NULL,
	`rink_count` integer NOT NULL,
	`rinks_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_empire_team_sheets_date` ON `empire_team_sheets` (`match_date`);