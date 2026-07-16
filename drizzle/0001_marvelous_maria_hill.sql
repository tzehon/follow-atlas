CREATE TABLE `import_staging` (
	`run_id` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text NOT NULL,
	`profile_url` text NOT NULL,
	`followed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`run_id`, `username`)
);
--> statement-breakpoint
CREATE INDEX `import_staging_run_idx` ON `import_staging` (`run_id`);