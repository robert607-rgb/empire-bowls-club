CREATE TABLE `empire_fixtures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fixture_date` text NOT NULL,
	`start_time` text NOT NULL,
	`opponent` text NOT NULL,
	`competition` text NOT NULL,
	`rink_count` integer NOT NULL,
	`rinks_json` text NOT NULL,
	`time_slot` text NOT NULL,
	`booking_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `empire_fixtures_booking_key_unique` ON `empire_fixtures` (`booking_key`);--> statement-breakpoint
CREATE INDEX `idx_empire_fixtures_date` ON `empire_fixtures` (`fixture_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `empire_fixtures_unique_match` ON `empire_fixtures` (`fixture_date`,`start_time`,`opponent`,`competition`);--> statement-breakpoint
ALTER TABLE `empire_bookings` ADD `fixture_key` text;