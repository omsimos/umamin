CREATE TABLE `post_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`upvote_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `postTable`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_comment_post_created_idx` ON `post_comment` (`post_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `post_comment_author_created_idx` ON `post_comment` (`author_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `post_comment_upvote` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `post_comment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_comment_upvote_comment_user_uidx` ON `post_comment_upvote` (`comment_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `post_comment_upvote_user_created_idx` ON `post_comment_upvote` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `postTable` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`author_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`upvote_count` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_created_at_id_idx` ON `postTable` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `post_author_created_at_idx` ON `postTable` (`author_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `post_upvote` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `postTable`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_upvote_post_user_uidx` ON `post_upvote` (`post_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `post_upvote_user_created_idx` ON `post_upvote` (`user_id`,`created_at`);