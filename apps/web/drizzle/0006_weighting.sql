ALTER TABLE `grade_types` ADD `area` text DEFAULT 'schriftlich' NOT NULL;--> statement-breakpoint
ALTER TABLE `grade_types` ADD `group_as` real;--> statement-breakpoint
ALTER TABLE `subjects` ADD `area_weights` text;