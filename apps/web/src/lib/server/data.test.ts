import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { calculate } from '@oberstufen-planer/abi-engine-bw';
import { openDb } from './db/index.ts';
import {
	createGrade,
	createSubject,
	ensureDefaults,
	listGradeTypes,
	loadAll,
	setCourse,
	setExam,
	setSetting,
	toPlanInput,
	updateSubject,
	type SubjectData
} from './data.ts';

const migrations = fileURLToPath(new URL('../../../drizzle', import.meta.url));

function setup() {
	const db = openDb(':memory:', migrations);
	ensureDefaults(db);
	return db;
}

const deutsch: SubjectData = {
	name: 'Deutsch',
	category: 'deutsch',
	level: 'LF',
	exam: 'written',
	fromClass8: true,
	color: '#2563eb',
	halfYears: [1, 2, 3, 4]
};

describe('data layer', () => {
	it('creates the default grade types once', () => {
		const db = setup();
		ensureDefaults(db);
		expect(listGradeTypes(db).map((t) => [t.name, t.area, t.groupAs])).toEqual([
			['Klausur', 'schriftlich', null],
			['Test', 'schriftlich', 1],
			['Mündlich / Mitarbeit', 'muendlich', null],
			['GFS', 'schriftlich', null],
			['Praktisch', 'praktisch', null]
		]);
	});

	it('creates a subject with its half-year courses', () => {
		const db = setup();
		const id = createSubject(db, deutsch);
		const s = loadAll(db).subjects.find((x) => x.id === id)!;
		expect(Object.keys(s.courses)).toEqual(['1', '2', '3', '4']);
		expect(s.courses[1]!.source).toBe('offen');
	});

	it('picks the report card grade over the forecast over the grades', () => {
		const db = setup();
		const id = createSubject(db, deutsch);
		const types = listGradeTypes(db);
		const klausur = types.find((t) => t.name === 'Klausur');
		const muendlich = types.find((t) => t.area === 'muendlich');
		const base = {
			subjectId: id,
			halfYear: 1 as const,
			forecast: null,
			weight: 1,
			date: null,
			note: ''
		};
		createGrade(db, { ...base, gradeTypeId: klausur!.id, points: 9 });
		createGrade(db, { ...base, gradeTypeId: klausur!.id, points: 11 });
		createGrade(db, { ...base, gradeTypeId: muendlich!.id, points: 13 });
		// open grade with an expected result
		createGrade(db, { ...base, gradeTypeId: muendlich!.id, points: null, forecast: 7 });

		let c = loadAll(db).subjects[0]!.courses[1]!;
		expect(c.source).toBe('noten');
		expect(c.fromGrades).toMatchObject({ exact: 11, points: 11 }); // (2·10 + 13) / 3
		expect(c.fromGradesProjected!.exact).toBeCloseTo((2 * 10 + 10) / 3); // mündlich (13 + 7) / 2
		expect(c.effective).toBe(10);
		expect(c.openCount).toBe(1);

		setCourse(db, id, 1, { forecast: 12 });
		c = loadAll(db).subjects[0]!.courses[1]!;
		expect(c.source).toBe('prognose');
		expect(c.effective).toBe(12);

		setCourse(db, id, 1, { points: 14 });
		c = loadAll(db).subjects[0]!.courses[1]!;
		expect(c.source).toBe('zeugnis');
		expect(c.effective).toBe(14);
	});

	it('keeps grades of remaining half-years and drops those of removed ones', () => {
		const db = setup();
		const id = createSubject(db, deutsch);
		const [klausur] = listGradeTypes(db);
		setCourse(db, id, 1, { points: 12 });
		for (const h of [1, 4] as const) {
			createGrade(db, {
				subjectId: id,
				halfYear: h,
				gradeTypeId: klausur!.id,
				points: 10,
				forecast: null,
				weight: 1,
				date: null,
				note: ''
			});
		}
		updateSubject(db, id, { ...deutsch, halfYears: [1, 2, 3] });
		const all = loadAll(db);
		expect(Object.keys(all.subjects[0]!.courses)).toEqual(['1', '2', '3']);
		expect(all.subjects[0]!.courses[1]!.points).toBe(12);
		expect(all.grades.map((g) => g.halfYear)).toEqual([1]);
	});

	it('maps to engine input: report card = real, everything else = forecast', () => {
		const db = setup();
		const id = createSubject(db, deutsch);
		setCourse(db, id, 1, { points: 12 });
		setCourse(db, id, 2, { forecast: 9 });
		setExam(db, id, { writtenForecast: 11 });
		const input = toPlanInput(loadAll(db));
		const s = input.subjects[0]!;
		expect(s.courses[1]).toEqual({ points: 12, forecast: null });
		expect(s.courses[2]).toEqual({ points: null, forecast: 9 });
		expect(s.courses[3]).toEqual({ points: null, forecast: null });
		expect(s.examResult?.writtenForecast).toBe(11);
		expect(() => calculate(input)).not.toThrow();
	});

	it("uses the subject's own weighting, else the default", () => {
		const db = setup();
		const id = createSubject(db, deutsch);
		const types = listGradeTypes(db);
		const k = types.find((t) => t.name === 'Klausur')!.id;
		const m = types.find((t) => t.area === 'muendlich')!.id;
		const base = {
			subjectId: id,
			halfYear: 1 as const,
			forecast: null,
			weight: 1,
			date: null,
			note: ''
		};
		createGrade(db, { ...base, gradeTypeId: k, points: 6 });
		createGrade(db, { ...base, gradeTypeId: m, points: 12 });
		// default 2/3 : 1/3 → 8
		expect(loadAll(db).subjects[0]!.courses[1]!.fromGrades!.exact).toBeCloseTo(8);
		setSetting(db, 'areaWeights', { schriftlich: 50, muendlich: 50, praktisch: 0 });
		expect(loadAll(db).subjects[0]!.courses[1]!.fromGrades!.exact).toBeCloseTo(9);
		updateSubject(db, id, {
			...deutsch,
			areaWeights: { schriftlich: 25, muendlich: 75, praktisch: 0 }
		});
		expect(loadAll(db).subjects[0]!.courses[1]!.fromGrades!.exact).toBeCloseTo(10.5);
		expect(loadAll(db).subjects[0]!.weights).toEqual({
			schriftlich: 25,
			muendlich: 75,
			praktisch: 0
		});
	});
});

describe('migration of existing installs (#10, #11)', () => {
	it('assigns areas to old grade types and adds Test and Praktisch', () => {
		// database at the state before the weighting change, with the old default types
		const dir = mkdtempSync(join(tmpdir(), 'op-mig-'));
		const oldMigrations = join(dir, 'drizzle');
		cpSync(migrations, oldMigrations, { recursive: true });
		const journalPath = join(oldMigrations, 'meta', '_journal.json');
		const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
		journal.entries = journal.entries.filter((e: { tag: string }) => !/weighting/.test(e.tag));
		writeFileSync(journalPath, JSON.stringify(journal));
		const file = join(dir, 'app.db');
		const old = openDb(file, oldMigrations);
		for (const [i, name] of ['Klausur', 'Mündlich / Mitarbeit', 'GFS'].entries()) {
			old.$client
				.prepare('INSERT INTO grade_types (id, name, weight, sort_order) VALUES (?, ?, 1, ?)')
				.run(`t${i}`, name, i);
		}
		old.$client.close();

		const db = openDb(file, migrations);
		expect(listGradeTypes(db).map((t) => [t.name, t.area, t.groupAs])).toEqual([
			['Klausur', 'schriftlich', null],
			['Mündlich / Mitarbeit', 'muendlich', null],
			['GFS', 'schriftlich', null],
			['Test', 'schriftlich', 1],
			['Praktisch', 'praktisch', null]
		]);
	});
});
