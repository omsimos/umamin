CREATE TABLE `poll_option` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`idx` integer NOT NULL,
	`label` text NOT NULL,
	`vote_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `postTable`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `poll_option_post_idx_uidx` ON `poll_option` (`post_id`,`idx`);--> statement-breakpoint
CREATE TABLE `poll_vote` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`option_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `postTable`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`option_id`) REFERENCES `poll_option`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `poll_vote_post_user_uidx` ON `poll_vote` (`post_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `poll_vote_user_post_idx` ON `poll_vote` (`user_id`,`post_id`);--> statement-breakpoint
ALTER TABLE `postTable` ADD `poll_ends_at` integer;