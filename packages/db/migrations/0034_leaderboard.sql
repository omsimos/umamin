ALTER TABLE `user` ADD `leaderboard_hidden` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `user_points_rank_idx` ON `user` ("points" DESC,`created_at`) WHERE banned_at IS NULL AND leaderboard_hidden = 0;--> statement-breakpoint
CREATE INDEX `user_streak_best_rank_idx` ON `user` ("streak_best" DESC,`created_at`) WHERE banned_at IS NULL AND leaderboard_hidden = 0;