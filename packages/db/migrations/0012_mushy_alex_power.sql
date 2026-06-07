ALTER TABLE `message` ADD `opened_at` integer;--> statement-breakpoint
UPDATE `message` SET `opened_at` = `created_at` WHERE `opened_at` IS NULL;
