-- Revision counter for app sync: every change of user data increases it.
INSERT INTO `sync_meta` (`id`, `revision`) VALUES (1, 1) ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TRIGGER `sync_subjects_insert` AFTER INSERT ON `subjects` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_subjects_update` AFTER UPDATE ON `subjects` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_subjects_delete` AFTER DELETE ON `subjects` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_courses_insert` AFTER INSERT ON `courses` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_courses_update` AFTER UPDATE ON `courses` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_courses_delete` AFTER DELETE ON `courses` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_grade_types_insert` AFTER INSERT ON `grade_types` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_grade_types_update` AFTER UPDATE ON `grade_types` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_grade_types_delete` AFTER DELETE ON `grade_types` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_grades_insert` AFTER INSERT ON `grades` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_grades_update` AFTER UPDATE ON `grades` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_grades_delete` AFTER DELETE ON `grades` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_exams_insert` AFTER INSERT ON `exams` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_exams_update` AFTER UPDATE ON `exams` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_exams_delete` AFTER DELETE ON `exams` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_events_insert` AFTER INSERT ON `events` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_events_update` AFTER UPDATE ON `events` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_events_delete` AFTER DELETE ON `events` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_timetable_slots_insert` AFTER INSERT ON `timetable_slots` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_timetable_slots_update` AFTER UPDATE ON `timetable_slots` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_timetable_slots_delete` AFTER DELETE ON `timetable_slots` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_tasks_insert` AFTER INSERT ON `tasks` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_tasks_update` AFTER UPDATE ON `tasks` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_tasks_delete` AFTER DELETE ON `tasks` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_study_goals_insert` AFTER INSERT ON `study_goals` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_study_goals_update` AFTER UPDATE ON `study_goals` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_study_goals_delete` AFTER DELETE ON `study_goals` BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_settings_insert` AFTER INSERT ON `settings` WHEN NEW.`key` IN ('profile','bll','overrides','reminderDefaults','timetable') BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_settings_update` AFTER UPDATE ON `settings` WHEN NEW.`key` IN ('profile','bll','overrides','reminderDefaults','timetable') BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_settings_delete` AFTER DELETE ON `settings` WHEN OLD.`key` IN ('profile','bll','overrides','reminderDefaults','timetable') BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
