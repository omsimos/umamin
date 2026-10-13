ALTER TABLE `message_reply` ADD `mod_severe` integer;--> statement-breakpoint
ALTER TABLE `message_reply` ADD `mod_drama` integer;--> statement-breakpoint
ALTER TABLE `message_reply` ADD `mod_reason` text;--> statement-breakpoint
ALTER TABLE `message` ADD `mod_severe` integer;--> statement-breakpoint
ALTER TABLE `message` ADD `mod_drama` integer;--> statement-breakpoint
ALTER TABLE `message` ADD `mod_reason` text;--> statement-breakpoint
ALTER TABLE `note` ADD `mod_severe` integer;--> statement-breakpoint
ALTER TABLE `note` ADD `mod_drama` integer;--> statement-breakpoint
ALTER TABLE `note` ADD `mod_reason` text;--> statement-breakpoint
ALTER TABLE `note` ADD `mod_flagged_at` integer;--> statement-breakpoint
ALTER TABLE `note` ADD `mod_cleared_at` integer;--> statement-breakpoint
CREATE INDEX `note_mod_flagged_idx` ON `note` (`mod_flagged_at`) WHERE "note"."mod_flagged_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `post_comment` ADD `mod_severe` integer;--> statement-breakpoint
ALTER TABLE `post_comment` ADD `mod_drama` integer;--> statement-breakpoint
ALTER TABLE `post_comment` ADD `mod_reason` text;--> statement-breakpoint
ALTER TABLE `post_comment` ADD `mod_flagged_at` integer;--> statement-breakpoint
ALTER TABLE `post_comment` ADD `mod_cleared_at` integer;--> statement-breakpoint
CREATE INDEX `post_comment_mod_flagged_idx` ON `post_comment` (`mod_flagged_at`) WHERE "post_comment"."mod_flagged_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `postTable` ADD `mod_severe` integer;--> statement-breakpoint
ALTER TABLE `postTable` ADD `mod_drama` integer;--> statement-breakpoint
ALTER TABLE `postTable` ADD `mod_reason` text;--> statement-breakpoint
ALTER TABLE `postTable` ADD `mod_flagged_at` integer;--> statement-breakpoint
ALTER TABLE `postTable` ADD `mod_cleared_at` integer;--> statement-breakpoint
CREATE INDEX `post_mod_flagged_idx` ON `postTable` (`mod_flagged_at`) WHERE "postTable"."mod_flagged_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `hide_drama` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `message_filter` integer DEFAULT false NOT NULL;