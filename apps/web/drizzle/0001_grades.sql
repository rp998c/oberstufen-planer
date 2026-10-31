CREATE TABLE `courses` (
	`subject_id` text NOT NULL,
	`half_year` integer NOT NULL,
	`points` integer,
	`forecast` integer,
	PRIMARY KEY(`subject_id`, `half_year`),
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `exams` (
	`subject_id` text PRIMARY KEY NOT NULL,
	`written` integer,
	`oral` integer,
	`written_forecast` integer,
	`oral_forecast` integer,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `grade_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`weight` real DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `grades` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`half_year` integer NOT NULL,
	`grade_type_id` text NOT NULL,
	`points` integer,
	`forecast` integer,
	`weight` real DEFAULT 1 NOT NULL,
	`date` text,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grade_type_id`) REFERENCES `grade_types`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`level` text NOT NULL,
	`exam` text,
	`from_class8` integer DEFAULT true NOT NULL,
	`color` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
