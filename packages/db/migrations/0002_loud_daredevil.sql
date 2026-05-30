CREATE INDEX `oauth_account_provider_idx` ON `oauth_account` (`provider_id`,`provider_user_id`);--> statement-breakpoint
CREATE INDEX `oauth_account_user_idx` ON `oauth_account` (`user_id`);