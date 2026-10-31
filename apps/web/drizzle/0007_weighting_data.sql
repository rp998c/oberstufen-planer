-- #11: grade types now belong to an area; existing installs get Test and Praktisch.
UPDATE `grade_types` SET `area` = 'muendlich' WHERE `name` LIKE '%mündlich%' OR `name` LIKE '%muendlich%' OR `name` LIKE '%mitarbeit%';
--> statement-breakpoint
UPDATE `grade_types` SET `area` = 'praktisch' WHERE `name` LIKE '%prakt%';
--> statement-breakpoint
INSERT INTO `grade_types` (`id`, `name`, `weight`, `sort_order`, `area`, `group_as`) SELECT lower(hex(randomblob(16))), 'Test', 1, (SELECT coalesce(max(`sort_order`), -1) + 1 FROM `grade_types`), 'schriftlich', 1 WHERE EXISTS (SELECT 1 FROM `grade_types`) AND NOT EXISTS (SELECT 1 FROM `grade_types` WHERE `name` LIKE 'Test%');
--> statement-breakpoint
INSERT INTO `grade_types` (`id`, `name`, `weight`, `sort_order`, `area`, `group_as`) SELECT lower(hex(randomblob(16))), 'Praktisch', 1, (SELECT coalesce(max(`sort_order`), -1) + 1 FROM `grade_types`), 'praktisch', NULL WHERE EXISTS (SELECT 1 FROM `grade_types`) AND NOT EXISTS (SELECT 1 FROM `grade_types` WHERE `area` = 'praktisch');
--> statement-breakpoint
-- the default weighting is a synced setting too
DROP TRIGGER IF EXISTS `sync_settings_insert`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `sync_settings_update`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `sync_settings_delete`;
--> statement-breakpoint
CREATE TRIGGER `sync_settings_insert` AFTER INSERT ON `settings` WHEN NEW.`key` IN ('profile','bll','overrides','reminderDefaults','timetable','areaWeights') BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_settings_update` AFTER UPDATE ON `settings` WHEN NEW.`key` IN ('profile','bll','overrides','reminderDefaults','timetable','areaWeights') BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `sync_settings_delete` AFTER DELETE ON `settings` WHEN OLD.`key` IN ('profile','bll','overrides','reminderDefaults','timetable','areaWeights') BEGIN UPDATE `sync_meta` SET `revision` = `revision` + 1 WHERE `id` = 1; END;
