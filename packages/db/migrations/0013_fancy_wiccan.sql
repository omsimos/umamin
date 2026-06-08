CREATE TABLE `group_member` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_member_group_user_uidx` ON `group_member` (`group_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `group_member_group_created_idx` ON `group_member` (`group_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `group_member_user_created_idx` ON `group_member` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `group_pending` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_pending_group_user_uidx` ON `group_pending` (`group_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `group_pending_group_created_idx` ON `group_pending` (`group_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `group_pending_user_created_idx` ON `group_pending` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `group` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`tag` text NOT NULL,
	`tag_norm` text NOT NULL,
	`icon` text NOT NULL,
	`accent` text,
	`creator_id` text NOT NULL,
	`member_count` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`creator_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_tag_norm_uidx` ON `group` (`tag_norm`);--> statement-breakpoint
CREATE INDEX `group_creator_idx` ON `group` (`creator_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `equipped_group_id` text;--> statement-breakpoint
CREATE INDEX `user_equipped_group_idx` ON `user` (`equipped_group_id`) WHERE "user"."equipped_group_id" IS NOT NULL;