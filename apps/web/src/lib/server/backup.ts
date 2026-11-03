import type { Db } from './db/index.ts';
import {
	courses,
	events,
	exams,
	gradeTypes,
	grades,
	settings,
	studyGoals,
	subjects,
	tasks,
	timetableSlots
} from './db/schema.ts';

export const BACKUP_FORMAT = 'oberstufen-planer-backup';
export const BACKUP_VERSION = 1;

/** Settings that belonged to the user's data before the redesign. */
const EXPORTED_SETTINGS = [
	'profile',
	'bll',
	'overrides',
	'reminderDefaults',
	'timetable',
	'ntfy',
	'areaWeights'
];

/** Tables in insert order (parents before children). */
const TABLES = {
	subjects,
	courses,
	gradeTypes,
	grades,
	exams,
	events,
	timetableSlots,
	tasks,
	studyGoals
} as const;
type TableName = keyof typeof TABLES;

/** Reads the tables of versions before the redesign (only used to migrate them once). */
export function exportLegacyData(db: Db) {
	const data: Record<string, unknown[]> = {};
	for (const [name, table] of Object.entries(TABLES)) data[name] = db.select().from(table).all();
	return {
		format: BACKUP_FORMAT,
		version: BACKUP_VERSION,
		exportedAt: new Date().toISOString(),
		settings: Object.fromEntries(
			db
				.select()
				.from(settings)
				.all()
				.filter((s) => EXPORTED_SETTINGS.includes(s.key))
				.map((s) => [s.key, s.value])
		),
		data
	};
}
