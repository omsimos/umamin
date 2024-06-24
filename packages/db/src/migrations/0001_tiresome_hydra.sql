DROP INDEX IF EXISTS `id_updated_at_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `receiver_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `sender_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `created_at_id_idx`;--> statement-breakpoint
ALTER TABLE `message` ADD `reply` text;--> statement-breakpoint
CREATE INDEX `updated_at_idx` ON `note` (`updated_at`);--> statement-breakpoint
CREATE INDEX `receiver_id_created_at_idx` ON `message` (`receiver_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `sender_id_created_at_idx` ON `message` (`sender_id`,`created_at`);