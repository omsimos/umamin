CREATE TABLE `group_message_reaction` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `group_message`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_message_reaction_message_user_uidx` ON `group_message_reaction` (`message_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `group_message_reaction_user_message_idx` ON `group_message_reaction` (`user_id`,`message_id`);--> statement-breakpoint
CREATE TABLE `group_message_read` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_read_message_id` text,
	`last_read_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_message_read_group_user_uidx` ON `group_message_read` (`group_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `group_message_read_user_idx` ON `group_message_read` (`user_id`);--> statement-breakpoint
CREATE TABLE `group_message` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`content` text NOT NULL,
	`reply_to_message_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reply_to_message_id`) REFERENCES `group_message`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `group_message_group_created_id_idx` ON `group_message` (`group_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `group_message_sender_idx` ON `group_message` (`sender_id`);--> statement-breakpoint
ALTER TABLE `group` ADD `last_message_at` integer;