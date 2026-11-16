ALTER TABLE `user` ADD `streak_broken` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `streak_restores_used` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `streak_restore_month` integer;--> statement-breakpoint
CREATE INDEX `user_streak_day_idx` ON `user` (`streak_day`) WHERE streak >= 2 AND push_prefs <> 0;--> statement-breakpoint
-- The streak reminder push category is new, so give it to everyone who already has push on. Push off stays 0.
UPDATE `user` SET `push_prefs` = `push_prefs` | 16 WHERE `push_prefs` <> 0;
