CREATE TABLE `moderation_dispute` (
	`kind` text NOT NULL,
	`target_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`kind`, `target_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `note` ADD `mod_reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `note` ADD `mod_appealed_at` integer;--> statement-breakpoint
ALTER TABLE `post_comment` ADD `mod_reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `post_comment` ADD `mod_appealed_at` integer;--> statement-breakpoint
ALTER TABLE `postTable` ADD `mod_reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `postTable` ADD `mod_appealed_at` integer;