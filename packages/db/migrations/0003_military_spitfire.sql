CREATE TABLE `user_follow` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_follow_follower_following_uidx` ON `user_follow` (`follower_id`,`following_id`);--> statement-breakpoint
CREATE INDEX `user_follow_follower_created_idx` ON `user_follow` (`follower_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_follow_following_created_idx` ON `user_follow` (`following_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `user` ADD `follower_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `following_count` integer DEFAULT 0 NOT NULL;