CREATE TABLE `dm_purge` (
	`thread_id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dm_report` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`reported_id` text,
	`thread_id` text NOT NULL,
	`message_seq` integer NOT NULL,
	`reason` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`resolved_at` integer,
	`resolved_by_id` text,
	`resolution` text,
	FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reported_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dm_report_reporter_message_uidx` ON `dm_report` (`reporter_id`,`thread_id`,`message_seq`);--> statement-breakpoint
CREATE INDEX `dm_report_open_idx` ON `dm_report` (`created_at`) WHERE "dm_report"."resolved_at" IS NULL;--> statement-breakpoint
CREATE INDEX `dm_report_reported_idx` ON `dm_report` (`reported_id`);--> statement-breakpoint
CREATE TABLE `dm_thread` (
	`id` text PRIMARY KEY NOT NULL,
	`user_low_id` text NOT NULL,
	`user_high_id` text NOT NULL,
	`last_message_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seq` integer DEFAULT 0 NOT NULL,
	`last_sender_id` text,
	`last_preview` text,
	`low_read_seq` integer DEFAULT 0 NOT NULL,
	`high_read_seq` integer DEFAULT 0 NOT NULL,
	`low_hidden_seq` integer DEFAULT 0 NOT NULL,
	`high_hidden_seq` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_low_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_high_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dm_thread_low_last_idx` ON `dm_thread` (`user_low_id`,`last_message_at`);--> statement-breakpoint
CREATE INDEX `dm_thread_high_last_idx` ON `dm_thread` (`user_high_id`,`last_message_at`);