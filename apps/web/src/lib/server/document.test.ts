import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openDb } from './db/index.ts';
import { courses, gradeTypes, grades, settings, subjects } from './db/schema.ts';
import { applyOps, getFeedToken, getSnapshot } from './document.ts';

const migrations = fileURLToPath(new URL('../../../drizzle', import.meta.url));

const subject = {
	id: 's1',
	name: 'Mathematik',
	color: '#4C6EF5',
	category: 'mathe',
	level: 'LF',
	exam: 'written',
	fromClass8: true,
	sortOrder: 0,
	halfYears: [1, 2, 3, 4],
	klausuren: 2,
	tests: 'none',
	weights: { schriftlich: 200 / 3, muendlich: 100 / 3, praktisch: 0 }
};

describe('user document', () => {
	it('starts empty and applies operations once', () => {
		const db = openDb(':memory:', migrations);
		const first = getSnapshot(db);
		expect(first.data.subjects).toEqual([]);

		const ops = [
			{ opId: 'a', op: { type: 'subject.upsert', subject } },
			{ opId: 'b', op: { type: 'zeugnis.set', subjectId: 's1', halfYear: 1, points: 13 } },
			{ opId: 'c', op: { type: 'zeugnis.set', subjectId: 's1', halfYear: 1, points: 99 } }
		];
		const res = applyOps(db, ops);
		expect(res.map((r) => r.ok)).toEqual([true, true, false]);
		expect(res[2]!.error).toContain('zwischen 0 und 15');
		const after = getSnapshot(db);
		expect(after.revision).toBe(first.revision + 1);
		expect(after.data.zeugnis).toEqual([{ subjectId: 's1', halfYear: 1, points: 13 }]);

		// resending the same batch (lost answer) changes nothing
		applyOps(db, ops);
		expect(getSnapshot(db).revision).toBe(after.revision);
	});

	it('rejects malformed requests', () => {
		const db = openDb(':memory:', migrations);
		expect(() => applyOps(db, 'nope')).toThrow();
		expect(() => applyOps(db, [{ opId: 'bad id!', op: {} }])).toThrow();
	});

	it('converts the data of an older version once', () => {
		const db = openDb(':memory:', migrations);
		db.insert(settings)
			.values({ key: 'profile', value: { abiYear: 2028 } })
			.run();
		db.insert(subjects)
			.values({
				id: 'm',
				name: 'Mathe',
				category: 'mathe',
				level: 'LF',
				exam: 'written',
				fromClass8: true,
				color: '#2563eb',
				sortOrder: 0
			})
			.run();
		db.insert(courses).values({ subjectId: 'm', halfYear: 1, points: 12 }).run();
		db.insert(courses).values({ subjectId: 'm', halfYear: 2 }).run();
		db.insert(gradeTypes)
			.values({ id: 't', name: 'Klausur', sortOrder: 0, area: 'schriftlich' })
			.run();
		db.insert(grades)
			.values({
				id: 'g',
				subjectId: 'm',
				halfYear: 2,
				gradeTypeId: 't',
				points: 11,
				weight: 1,
				date: '2027-03-01',
				note: ''
			})
			.run();

		const s = getSnapshot(db);
		expect(s.data.profile.abiYear).toBe(2028);
		expect(s.data.subjects[0]).toMatchObject({ id: 'm', halfYears: [1, 2], klausuren: 2 });
		expect(s.data.zeugnis).toEqual([{ subjectId: 'm', halfYear: 1, points: 12 }]);
		expect(s.data.grades[0]).toMatchObject({ kind: 'klausur', points: 11 });
		// stored: a second read does not convert again
		db.delete(subjects).run();
		expect(getSnapshot(db).data.subjects).toHaveLength(1);
	});

	it('keeps a stable calendar feed token until renewed', () => {
		const db = openDb(':memory:', migrations);
		const t = getFeedToken(db);
		expect(getFeedToken(db)).toBe(t);
		expect(getFeedToken(db, true)).not.toBe(t);
	});
});
