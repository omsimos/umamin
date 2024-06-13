CREATE TABLE `oauth_account` (
	`provider_user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`picture` text NOT NULL,
	`user_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text,
	`bio` text,
	`image_url` text,
	`quiet_mode` integer DEFAULT false NOT NULL,
	`question` text DEFAULT 'Send me an anonymous message!' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `note` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`is_anonymous` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`content` text NOT NULL,
	`receiver_id` text NOT NULL,
	`sender_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `note_user_id_unique` ON `note` (`user_id`);--> statement-breakpoint
CREATE INDEX `id_updated_at_idx` ON `note` (`id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `receiver_id_idx` ON `message` (`receiver_id`);--> statement-breakpoint
CREATE INDEX `sender_id_idx` ON `message` (`sender_id`);--> statement-breakpoint
CREATE INDEX `created_at_id_idx` ON `message` (`created_at`,`id`);