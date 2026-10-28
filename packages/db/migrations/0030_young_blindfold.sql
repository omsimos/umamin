DROP INDEX `note_mod_flagged_idx`;--> statement-breakpoint
CREATE INDEX `note_unclassified_updated_idx` ON `note` (`updated_at`) WHERE "note"."mod_severe" IS NULL;--> statement-breakpoint
CREATE INDEX `note_mod_pending_idx` ON `note` (`mod_flagged_at`,`id`) WHERE "note"."mod_flagged_at" IS NOT NULL AND "note"."mod_cleared_at" IS NULL AND "note"."mod_reviewed_at" IS NULL;--> statement-breakpoint
DROP INDEX `post_comment_mod_flagged_idx`;--> statement-breakpoint
CREATE INDEX `post_comment_unclassified_created_idx` ON `post_comment` (`created_at`) WHERE "post_comment"."mod_severe" IS NULL;--> statement-breakpoint
CREATE INDEX `post_comment_mod_pending_idx` ON `post_comment` (`mod_flagged_at`,`id`) WHERE "post_comment"."mod_flagged_at" IS NOT NULL AND "post_comment"."mod_cleared_at" IS NULL AND "post_comment"."mod_reviewed_at" IS NULL;--> statement-breakpoint
DROP INDEX `post_mod_flagged_idx`;--> statement-breakpoint
CREATE INDEX `post_unclassified_created_idx` ON `postTable` (`created_at`) WHERE "postTable"."mod_severe" IS NULL;--> statement-breakpoint
CREATE INDEX `post_mod_pending_idx` ON `postTable` (`mod_flagged_at`,`id`) WHERE "postTable"."mod_flagged_at" IS NOT NULL AND "postTable"."mod_cleared_at" IS NULL AND "postTable"."mod_reviewed_at" IS NULL;