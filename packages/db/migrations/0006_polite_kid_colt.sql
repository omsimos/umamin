ALTER TABLE `postTable` ADD `quoted_post_id` text;--> statement-breakpoint
INSERT INTO `postTable` (`id`, `content`, `quoted_post_id`, `author_id`, `created_at`, `updated_at`, `like_count`, `comment_count`, `repost_count`)
SELECT lower(hex(randomblob(12))), `content`, `post_id`, `user_id`, `created_at`, `updated_at`, 0, 0, 0
FROM `post_repost`
WHERE `content` IS NOT NULL AND `content` != '';--> statement-breakpoint
DELETE FROM `post_repost` WHERE `content` IS NOT NULL AND `content` != '';--> statement-breakpoint
ALTER TABLE `post_repost` DROP COLUMN `content`;