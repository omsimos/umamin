DROP INDEX IF EXISTS `oauth_account_provider_idx`;--> statement-breakpoint
CREATE INDEX `post_repost_created_idx` ON `post_repost` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
-- Backfill notes created before updated_at was set on insert: they had NULL
-- updated_at, which sank them in the notes feed and produced NaN cursors.
UPDATE `note` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;