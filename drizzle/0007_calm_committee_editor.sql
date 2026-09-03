CREATE TABLE `empire_committee` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `empire_committee_meta` (
	`id` integer PRIMARY KEY NOT NULL,
	`seeded_at` text NOT NULL
);
