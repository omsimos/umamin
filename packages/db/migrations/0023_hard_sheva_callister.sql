CREATE TABLE `message_reply` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`from_sender` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `message_reply_message_created_id_idx` ON `message_reply` (`message_id`,`created_at`,`id`);--> statement-breakpoint
ALTER TABLE `message` ADD `last_reply_at` integer;--> statement-breakpoint
ALTER TABLE `message` ADD `sender_read_at` integer;--> statement-breakpoint
ALTER TABLE `message` ADD `receiver_read_at` integer;