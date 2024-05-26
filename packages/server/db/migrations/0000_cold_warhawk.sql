CREATE TABLE `oauth_account` (
	`provider_user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`picture` text NOT NULL,
	`user_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`note` text,
	`bio` text,
	`image_url` text,
	`quiet_mode` integer DEFAULT false NOT NULL,
	`question` text DEFAULT 'Send me an anonymous message!' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`content` text NOT NULL,
	`user_id` text NOT NULL,
	`sender_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE INDEX `note_updated_at_idx` ON `user` (`note`,`updated_at`);--> statement-breakpoint
CREATE INDEX `note_updated_at_id_idx` ON `user` (`note`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `user_id_created_at_idx` ON `message` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_id_created_at_id_idx` ON `message` (`user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `sender_id_created_at_idx` ON `message` (`sender_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `sender_id_created_at_id_idx` ON `message` (`user_id`,`created_at`,`id`);