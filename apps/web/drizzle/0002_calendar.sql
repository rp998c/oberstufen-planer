CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`start` text NOT NULL,
	`end` text,
	`all_day` integer DEFAULT true NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`reminders` text DEFAULT '[]' NOT NULL,
	`external_uid` text,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_external_uid_unique` ON `events` (`external_uid`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sent_reminders` (
	`event_id` text NOT NULL,
	`minutes` integer NOT NULL,
	`sent_at` integer NOT NULL,
	PRIMARY KEY(`event_id`, `minutes`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
