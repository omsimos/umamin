ALTER TABLE `postTable` ADD `comment_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `post_comment` DROP COLUMN `comment_count`;