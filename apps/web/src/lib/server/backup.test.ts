import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { BackupError, exportData, importData } from './backup.ts';
import {
	createGrade,
	createSubject,
	ensureDefaults,
	listGradeTypes,
	loadAll,
	setCourse,
	setSetting,
	getSetting
} from './data.ts';
import { openDb } from './db/index.ts';
import { events, studyGoals, tasks, timetableSlots } from './db/schema.ts';

const migrations = fileURLToPath(new URL('../../../drizzle', import.meta.url));

function filled() {
	const db = openDb(':memory:', migrations);
	ensureDefaults(db);
	const id = createSubject(db, {
		name: 'Deutsch',
		category: 'deutsch',
		level: 'LF',
		exam: 'written',
		fromClass8: true,
		color: '#2563eb',
		halfYears: [1, 2, 3, 4]
	});
	setCourse(db, id, 1, { points: 12 });
	createGrade(db, {
		subjectId: id,
		halfYear: 2,
		gradeTypeId: listGradeTypes(db)[0]!.id,
		points: 11,
		forecast: null,
		weight: 1,
		date: '2026-10-01',
		note: 'Erörterung'
	});
	db.insert(events)
		.values({
			id: randomUUID(),
			subjectId: id,
			title: 'Klausur',
			kind: 'klausur',
			start: '2026-11-20',
			allDay: true,
			reminders: [1440]
		})
		.run();
	db.insert(timetableSlots)
		.values({ id: randomUUID(), weekday: 1, period: 2, subjectId: id, room: 'A12' })
		.run();
	db.insert(tasks)
		.values({
			id: randomUUID(),
			title: 'Lesen',
			subjectId: id,
			createdAt: new Date(1_700_000_000_000)
		})
		.run();
	db.insert(studyGoals)
		.values({
			id: randomUUID(),
			title: '12 Punkte',
			subjectId: id,
			targetPoints: 12,
			createdAt: new Date()
		})
		.run();
	setSetting(db, 'profile', { abiYear: 2028 });
	setSetting(db, 'feedToken', 'secret');
	return db;
}

describe('backup', () => {
	it('round-trips all user data', () => {
		const source = filled();
		const backup = JSON.parse(JSON.stringify(exportData(source)));
		expect(backup.settings.feedToken).toBeUndefined();

		const target = openDb(':memory:', migrations);
		ensureDefaults(target);
		setSetting(target, 'feedToken', 'other');
		importData(target, backup);

		const a = loadAll(source);
		const b = loadAll(target);
		expect(b.subjects).toEqual(a.subjects);
		expect(b.grades).toEqual(a.grades);
		expect(b.profile).toEqual({ abiYear: 2028 });
		expect(target.select().from(tasks).all()).toEqual(source.select().from(tasks).all());
		expect(target.select().from(timetableSlots).all()).toEqual(
			source.select().from(timetableSlots).all()
		);
		expect(target.select().from(events).all()).toEqual(source.select().from(events).all());
		// server secrets are not replaced
		expect(getSetting(target, 'feedToken', null)).toBe('other');
	});

	it('rejects foreign files', () => {
		const db = filled();
		expect(() => importData(db, { hello: 'world' })).toThrow(BackupError);
		expect(() =>
			importData(db, { format: 'oberstufen-planer-backup', version: 99, data: {} })
		).toThrow(/neueren Version/);
	});

	it('changes nothing if the backup is broken', () => {
		const db = filled();
		const before = exportData(db).data;
		const broken = JSON.parse(JSON.stringify(exportData(db)));
		broken.data.grades[0].subjectId = 'does-not-exist';
		expect(() => importData(db, broken)).toThrow(/nichts geändert/);
		expect(exportData(db).data).toEqual(before);
	});
});
