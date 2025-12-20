CREATE TABLE `post_repost` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `postTable`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_repost_post_user_uidx` ON `post_repost` (`post_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `post_repost_user_created_idx` ON `post_repost` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `post_repost_post_created_idx` ON `post_repost` (`post_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `postTable` ADD `repost_count` integer DEFAULT 0 NOT NULL;