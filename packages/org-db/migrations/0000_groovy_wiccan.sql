CREATE TABLE `org_message` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`question` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `org`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `org_message_org_created_id_idx` ON `org_message` (`org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `org` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`password_hash` text NOT NULL,
	`question` text DEFAULT 'Send us an anonymous message!' NOT NULL,
	`image_url` text,
	`must_change_password` integer DEFAULT true NOT NULL,
	`accepting_messages` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `org_username_unique` ON `org` (`username`);--> statement-breakpoint
CREATE TABLE `org_session` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `org`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `org_session_org_idx` ON `org_session` (`org_id`);