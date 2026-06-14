CREATE TABLE `push_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`last_notified_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscription_endpoint_uidx` ON `push_subscription` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_subscription_user_idx` ON `push_subscription` (`user_id`);--> statement-breakpoint
CREATE INDEX `push_subscription_last_notified_idx` ON `push_subscription` (`last_notified_at`) WHERE "push_subscription"."last_notified_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `push_prefs` integer DEFAULT 0 NOT NULL;