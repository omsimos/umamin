CREATE TABLE `post_comment_like` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `post_comment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_comment_like_comment_user_uidx` ON `post_comment_like` (`comment_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `post_comment_like_user_created_idx` ON `post_comment_like` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `post_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `postTable`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_comment_post_created_idx` ON `post_comment` (`post_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `post_comment_author_created_idx` ON `post_comment` (`author_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `post_like` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `postTable`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_like_post_user_uidx` ON `post_like` (`post_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `post_like_user_created_idx` ON `post_like` (`user_id`,`created_at`);--> statement-breakpoint
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
CREATE TABLE `postTable` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`author_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`repost_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_created_at_id_idx` ON `postTable` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `post_author_created_at_idx` ON `postTable` (`author_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `user_block` (
	`id` text PRIMARY KEY NOT NULL,
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`blocker_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_block_blocker_blocked_uidx` ON `user_block` (`blocker_id`,`blocked_id`);--> statement-breakpoint
CREATE INDEX `user_block_blocker_created_idx` ON `user_block` (`blocker_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_block_blocked_created_idx` ON `user_block` (`blocked_id`,`created_at`);--> statement-breakpoint
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