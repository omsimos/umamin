ALTER TABLE `user` ADD `streak_push_off` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- 0035 set bit 16 of push_prefs for streak reminders; the opt-out moved to streak_push_off, so clear the unused bit.
UPDATE `user` SET `push_prefs` = `push_prefs` & ~16 WHERE (`push_prefs` & 16) <> 0;
