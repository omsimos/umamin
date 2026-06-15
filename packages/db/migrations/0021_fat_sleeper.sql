ALTER TABLE `note` ADD `music_provider` text;--> statement-breakpoint
ALTER TABLE `note` ADD `music_id` text;--> statement-breakpoint
ALTER TABLE `note` ADD `music_title` text;--> statement-breakpoint
ALTER TABLE `note` ADD `music_thumbnail` text;--> statement-breakpoint
UPDATE `note` SET `music_provider` = 'spotify', `music_id` = `spotify_track_id`, `music_title` = `spotify_title`, `music_thumbnail` = `spotify_thumbnail` WHERE `spotify_track_id` IS NOT NULL AND `music_id` IS NULL;