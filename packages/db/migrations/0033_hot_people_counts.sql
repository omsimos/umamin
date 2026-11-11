ALTER TABLE `postTable` ADD `commenter_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `postTable` ADD `liker_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `postTable` ADD `voter_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `postTable` ADD `resharer_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `post_quoted_author_idx` ON `postTable` (`quoted_post_id`,`author_id`) WHERE "postTable"."quoted_post_id" IS NOT NULL;--> statement-breakpoint
UPDATE `postTable` SET `commenter_count` = (SELECT COUNT(DISTINCT `c`.`author_id`) FROM `post_comment` `c` WHERE `c`.`post_id` = `postTable`.`id` AND `c`.`author_id` <> `postTable`.`author_id`) WHERE `comment_count` > 0;--> statement-breakpoint
UPDATE `postTable` SET `liker_count` = (SELECT COUNT(*) FROM `post_like` `l` WHERE `l`.`post_id` = `postTable`.`id` AND `l`.`user_id` <> `postTable`.`author_id`) WHERE `like_count` > 0;--> statement-breakpoint
UPDATE `postTable` SET `voter_count` = (SELECT COUNT(*) FROM `poll_vote` `v` WHERE `v`.`post_id` = `postTable`.`id` AND `v`.`user_id` <> `postTable`.`author_id`) WHERE `poll_vote_count` > 0;--> statement-breakpoint
UPDATE `postTable` SET `resharer_count` = (SELECT COUNT(*) FROM (SELECT `r`.`user_id` AS `u` FROM `post_repost` `r` WHERE `r`.`post_id` = `postTable`.`id` UNION SELECT `q`.`author_id` FROM `postTable` `q` WHERE `q`.`quoted_post_id` = `postTable`.`id`) WHERE `u` <> `postTable`.`author_id`) WHERE `repost_count` > 0;
