CREATE TABLE `pro_purchase` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`order_id` text NOT NULL,
	`identifier` text,
	`variant_id` integer,
	`total` integer,
	`currency` text,
	`test_mode` integer DEFAULT false NOT NULL,
	`refunded_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pro_purchase_order_uidx` ON `pro_purchase` (`order_id`);--> statement-breakpoint
CREATE INDEX `pro_purchase_user_idx` ON `pro_purchase` (`user_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `pro_until` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `profile_theme` text;