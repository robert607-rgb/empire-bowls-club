CREATE TABLE `empire_news` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`category` text NOT NULL,
	`accent` text NOT NULL,
	`emoji` text NOT NULL,
	`published_at` text NOT NULL,
	`created_at` text NOT NULL
);
