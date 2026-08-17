CREATE TABLE `empire_bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_date` text NOT NULL,
	`rink_number` integer NOT NULL,
	`time_slot` text NOT NULL,
	`booking_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `empire_bookings_slot_unique` ON `empire_bookings` (`booking_date`,`rink_number`,`time_slot`);--> statement-breakpoint
CREATE TABLE `empire_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`membership_type` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `empire_uploads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`created_at` text NOT NULL
);
