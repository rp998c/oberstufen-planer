import { eq } from 'drizzle-orm';
import type { Db } from './db/index.ts';
import {
	courses,
	events,
	exams,
	gradeTypes,
	grades,
	sentReminders,
	settings,
	studyGoals,
	subjects,
	tasks,
	timetableSlots
} from './db/schema.ts';

export const BACKUP_FORMAT = 'oberstufen-planer-backup';
export const BACKUP_VERSION = 1;

/** Settings that belong to the user's data. Secrets (VAPID keys, feed token) stay on the server. */
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

export function exportData(db: Db) {
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

export class BackupError extends Error {}

/** Date columns stored as timestamps come back from JSON as strings or numbers. */
const DATE_COLUMNS: Partial<Record<TableName, string[]>> = {
	tasks: ['createdAt'],
	studyGoals: ['createdAt']
};

/**
 * Replaces all user data with the backup. Runs in one transaction: on any error nothing
 * is changed. Login sessions, push subscriptions and server secrets are kept.
 */
export function importData(db: Db, backup: unknown) {
	if (typeof backup !== 'object' || backup === null)
		throw new BackupError('Keine gültige Sicherung.');
	const b = backup as { format?: unknown; version?: unknown; settings?: unknown; data?: unknown };
	if (b.format !== BACKUP_FORMAT)
		throw new BackupError('Das ist keine Sicherung des Oberstufen-Planers.');
	if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
		throw new BackupError(
			'Die Sicherung stammt aus einer neueren Version – bitte die App aktualisieren.'
		);
	}
	if (typeof b.data !== 'object' || b.data === null)
		throw new BackupError('Die Sicherung enthält keine Daten.');
	const data = b.data as Record<string, unknown>;
	for (const name of Object.keys(TABLES)) {
		if (data[name] !== undefined && !Array.isArray(data[name])) {
			throw new BackupError(`Ungültige Daten in „${name}“.`);
		}
	}

	try {
		db.transaction((tx) => {
			tx.delete(sentReminders).run();
			for (const table of Object.values(TABLES).reverse()) tx.delete(table).run();
			for (const [name, table] of Object.entries(TABLES) as [
				TableName,
				(typeof TABLES)[TableName]
			][]) {
				const rows = (data[name] as Record<string, unknown>[] | undefined) ?? [];
				for (const row of rows) {
					const values = { ...row };
					for (const col of DATE_COLUMNS[name] ?? []) {
						if (values[col] !== undefined) values[col] = new Date(values[col] as string | number);
					}
					tx.insert(table)
						.values(values as any)
						.run();
				}
			}
			const s = (b.settings ?? {}) as Record<string, unknown>;
			for (const key of EXPORTED_SETTINGS) {
				tx.delete(settings).where(eqKey(key)).run();
				if (s[key] !== undefined) tx.insert(settings).values({ key, value: s[key] }).run();
			}
		});
	} catch (e) {
		if (e instanceof BackupError) throw e;
		console.error('Backup import failed', e);
		throw new BackupError(
			'Die Sicherung konnte nicht eingespielt werden (ungültige oder unvollständige Daten). Es wurde nichts geändert.'
		);
	}
}

const eqKey = (key: string) => eq(settings.key, key);
