CREATE TABLE `note_reaction` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `note`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `note_reaction_note_user_uidx` ON `note_reaction` (`note_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `note_reaction_user_note_idx` ON `note_reaction` (`user_id`,`note_id`);--> statement-breakpoint
ALTER TABLE `note` ADD `reaction_count` integer DEFAULT 0 NOT NULL;