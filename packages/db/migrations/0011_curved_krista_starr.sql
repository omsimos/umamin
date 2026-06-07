ALTER TABLE `postTable` ADD `poll_vote_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `postTable` SET `poll_vote_count` = (
  SELECT COALESCE(SUM(`vote_count`), 0)
  FROM `poll_option`
  WHERE `poll_option`.`post_id` = `postTable`.`id`
);
