CREATE TABLE `applied_ops` (
	`op_id` text PRIMARY KEY NOT NULL,
	`applied_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_meta` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD `kind` text DEFAULT 'browser' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `name` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `last_seen_at` integer;