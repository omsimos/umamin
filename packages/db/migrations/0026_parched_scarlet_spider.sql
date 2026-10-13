CREATE TABLE `user_mute` (
	`id` text PRIMARY KEY NOT NULL,
	`muter_id` text NOT NULL,
	`muted_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`muter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`muted_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_mute_muter_muted_uidx` ON `user_mute` (`muter_id`,`muted_id`);--> statement-breakpoint
CREATE INDEX `user_mute_muter_created_idx` ON `user_mute` (`muter_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_mute_muted_idx` ON `user_mute` (`muted_id`);