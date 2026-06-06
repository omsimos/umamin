CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_id` text NOT NULL,
	`type` text NOT NULL,
	`target_id` text DEFAULT '' NOT NULL,
	`actor_id` text,
	`count` integer DEFAULT 1 NOT NULL,
	`preview` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`recipient_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_recipient_type_target_uidx` ON `notification` (`recipient_id`,`type`,`target_id`);--> statement-breakpoint
CREATE INDEX `notification_recipient_updated_id_idx` ON `notification` (`recipient_id`,`updated_at`,`id`);--> statement-breakpoint
ALTER TABLE `user` ADD `last_seen_notifications_at` integer;