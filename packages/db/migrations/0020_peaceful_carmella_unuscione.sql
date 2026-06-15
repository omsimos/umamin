ALTER TABLE `user` ADD `banned_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banned_by` text;--> statement-breakpoint
CREATE INDEX `user_banned_idx` ON `user` (`banned_at`) WHERE "user"."banned_at" IS NOT NULL;