import { describe, expect, it } from 'vitest';
import {
	OpError,
	abiResult,
	applyToData,
	emptyData,
	exportSubjects,
	halfYearOf,
	halfYearView,
	migrateData,
	plannedNotifications,
	targetFor,
	validateOp,
	type CalEvent,
	type Data,
	type Subject
} from './index.ts';

const subject = (over: Partial<Subject> = {}): Subject => ({
	id: 's1',
	name: 'Englisch',
	color: '#E8590C',
	category: 'fremdsprache',
	level: 'LF',
	exam: 'written',
	fromClass8: true,
	sortOrder: 0,
	halfYears: [1, 2, 3, 4],
	klausuren: 2,
	tests: 'klausur',
	weights: { schriftlich: 75, muendlich: 25, praktisch: 0 },
	...over
});

const ev = (over: Partial<CalEvent>): CalEvent => ({
	id: 'e1',
	subjectId: null,
	title: 'Mathe',
	kind: 'klausur',
	start: '2026-11-20',
	end: null,
	allDay: true,
	note: '',
	reminders: [1440],
	externalUid: null,
	...over
});

function apply(d: Data, ...ops: unknown[]): Data {
	return ops.reduce<Data>((acc, op) => applyToData(acc, validateOp(op)), d);
}

describe('validateOp', () => {
	it('accepts valid and rejects invalid operations', () => {
		expect(() => validateOp({ type: 'subject.upsert', subject: subject() })).not.toThrow();
		expect(() =>
			validateOp({ type: 'zeugnis.set', subjectId: 's1', halfYear: 2, points: 12 })
		).not.toThrow();
		expect(() =>
			validateOp({ type: 'zeugnis.set', subjectId: 's1', halfYear: 5, points: 12 })
		).toThrow(OpError);
		expect(() =>
			validateOp({
				type: 'subject.upsert',
				subject: subject({ weights: { schriftlich: 0, muendlich: 0, praktisch: 0 } })
			})
		).toThrow('Mindestens ein Bereich');
		expect(() =>
			validateOp({
				type: 'grade.upsert',
				grade: {
					id: 'g',
					subjectId: 's1',
					halfYear: 1,
					kind: 'klausur',
					points: 16,
					date: null,
					note: ''
				}
			})
		).toThrow('zwischen 0 und 15');
		expect(() => validateOp({ type: 'goal.set', goal: 9 })).toThrow(OpError);
		expect(() => validateOp({ type: 'nope' })).toThrow('Unbekannte');
	});
});

describe('half-year grade from single grades', () => {
	it('weights areas per subject and groups tests like one Klausur', () => {
		const grades = [
			['klausur', 8],
			['klausur', 12],
			['test', 15],
			['test', 15],
			['test', 9],
			['muendlich', 14]
		].map(([kind, points], i) => ({
			type: 'grade.upsert',
			grade: { id: `g${i}`, subjectId: 's1', halfYear: 1, kind, points, date: null, note: '' }
		}));
		const d = apply(emptyData(), { type: 'subject.upsert', subject: subject() }, ...grades);
		const v = halfYearView(d, d.subjects[0]!, 1)!;
		// schriftlich: (8 + 12 + 13) / 3 = 11, mündlich 14 → 11 × 0,75 + 14 × 0,25 = 11,75
		expect(v.result!.exact).toBeCloseTo(11.75);
		expect(v.effective).toBe(12);
		expect(v.source).toBe('noten');

		const z = apply(d, { type: 'zeugnis.set', subjectId: 's1', halfYear: 1, points: 11 });
		expect(halfYearView(z, z.subjects[0]!, 1)).toMatchObject({ effective: 11, source: 'zeugnis' });
		expect(halfYearView(z, z.subjects[0]!, 2)).toMatchObject({ effective: null, source: 'offen' });
	});

	it('counts tests as oral grades when set so', () => {
		const d = apply(
			emptyData(),
			{
				type: 'subject.upsert',
				subject: subject({
					tests: 'muendlich',
					weights: { schriftlich: 50, muendlich: 50, praktisch: 0 }
				})
			},
			{
				type: 'grade.upsert',
				grade: {
					id: 'a',
					subjectId: 's1',
					halfYear: 1,
					kind: 'klausur',
					points: 10,
					date: null,
					note: ''
				}
			},
			{
				type: 'grade.upsert',
				grade: {
					id: 'b',
					subjectId: 's1',
					halfYear: 1,
					kind: 'test',
					points: 14,
					date: null,
					note: ''
				}
			}
		);
		expect(halfYearView(d, d.subjects[0]!, 1)!.result!.exact).toBeCloseTo(12);
	});
});

describe('applyToData', () => {
	it('deletes everything of a removed subject but keeps its events', () => {
		const d = apply(
			emptyData(),
			{ type: 'subject.upsert', subject: subject() },
			{
				type: 'grade.upsert',
				grade: {
					id: 'g',
					subjectId: 's1',
					halfYear: 1,
					kind: 'klausur',
					points: 10,
					date: null,
					note: ''
				}
			},
			{ type: 'event.upsert', event: ev({ subjectId: 's1' }) },
			{ type: 'subject.delete', id: 's1' }
		);
		expect(d.subjects).toHaveLength(0);
		expect(d.grades).toHaveLength(0);
		expect(d.events[0]!.subjectId).toBeNull();
	});

	it('imports calendar events without duplicates', () => {
		const imported = ev({
			id: 'x1',
			externalUid: 'uid-1',
			title: 'Ferien',
			kind: 'sonstiges',
			reminders: []
		});
		let d = apply(emptyData(), { type: 'events.import', events: [imported] });
		d = apply(d, {
			type: 'events.import',
			events: [{ ...imported, id: 'x2', title: 'Herbstferien' }]
		});
		expect(d.events).toHaveLength(1);
		expect(d.events[0]).toMatchObject({ id: 'x1', title: 'Herbstferien' });
	});

	it('merges shared subject settings by name', () => {
		const mine = apply(emptyData(), {
			type: 'subject.upsert',
			subject: subject({ weights: { schriftlich: 50, muendlich: 50, praktisch: 0 } })
		});
		const shared = exportSubjects(
			apply(emptyData(), {
				type: 'subject.upsert',
				subject: subject({ id: 'other', klausuren: 3 })
			})
		);
		const merged = apply(mine, { type: 'subjects.merge', subjects: shared.subjects });
		expect(merged.subjects[0]).toMatchObject({
			id: 's1',
			klausuren: 3,
			weights: { schriftlich: 75 }
		});
		const fresh = apply(emptyData(), { type: 'subjects.merge', subjects: shared.subjects });
		expect(fresh.subjects).toHaveLength(1);
		expect(fresh.subjects[0]!.name).toBe('Englisch');
	});
});

describe('half-year of a date', () => {
	it('derives J1/J2 from the Abitur year', () => {
		expect(halfYearOf('2026-11-03', 2028)).toBe(1);
		expect(halfYearOf('2027-02-01', 2028)).toBe(2);
		expect(halfYearOf('2027-09-15', 2028)).toBe(3);
		expect(halfYearOf('2028-03-01', 2028)).toBe(4);
		expect(halfYearOf('2025-01-01', 2028)).toBe(1);
	});
});

describe('migration from the old format', () => {
	it('converts old tables to the new document', () => {
		const old = {
			format: 'oberstufen-planer-backup',
			version: 1,
			settings: {
				profile: { abiYear: 2028 },
				areaWeights: { schriftlich: 60, muendlich: 40, praktisch: 0 }
			},
			data: {
				subjects: [
					{
						id: 's1',
						name: 'Mathe',
						category: 'mathe',
						level: 'LF',
						exam: 'written',
						fromClass8: true,
						color: '#2563eb',
						sortOrder: 0,
						areaWeights: null
					}
				],
				courses: [
					{ subjectId: 's1', halfYear: 1, points: 12, forecast: null },
					{ subjectId: 's1', halfYear: 2, points: null, forecast: 11 }
				],
				gradeTypes: [
					{ id: 't1', name: 'Klausur', area: 'schriftlich', groupAs: null },
					{ id: 't2', name: 'Test', area: 'schriftlich', groupAs: 1 },
					{ id: 't3', name: 'GFS', area: 'schriftlich', groupAs: null },
					{ id: 't4', name: 'Mündlich', area: 'muendlich', groupAs: null }
				],
				grades: [
					{
						id: 'g1',
						subjectId: 's1',
						halfYear: 2,
						gradeTypeId: 't2',
						points: 13,
						forecast: null,
						weight: 1,
						date: null,
						note: ''
					},
					{
						id: 'g2',
						subjectId: 's1',
						halfYear: 2,
						gradeTypeId: 't3',
						points: 14,
						forecast: null,
						weight: 1,
						date: null,
						note: ''
					},
					{
						id: 'g3',
						subjectId: 's1',
						halfYear: 2,
						gradeTypeId: 't1',
						points: null,
						forecast: 9,
						weight: 1,
						date: null,
						note: ''
					}
				],
				exams: [
					{ subjectId: 's1', written: null, oral: null, writtenForecast: 10, oralForecast: null }
				],
				events: [ev({ kind: 'gfs' })],
				tasks: [],
				studyGoals: []
			}
		};
		const d = migrateData(old);
		expect(d.version).toBe(2);
		expect(d.profile.abiYear).toBe(2028);
		expect(d.subjects[0]).toMatchObject({
			halfYears: [1, 2],
			klausuren: 2,
			tests: 'klausur',
			weights: { schriftlich: 60 }
		});
		expect(d.zeugnis).toEqual([{ subjectId: 's1', halfYear: 1, points: 12 }]);
		expect(d.grades.map((g) => g.kind)).toEqual(['test', 'gfs']);
		expect(d.exams).toEqual([{ subjectId: 's1', written: null, oral: null }]);
		expect(() => validateOp({ type: 'data.replace', data: d })).not.toThrow();
		expect(() => migrateData({ hello: 1 })).toThrow();
	});
});

describe('Abitur and target grade', () => {
	function fullSetup(points: number): Data {
		const subjects: [string, Subject['category'], 'LF' | 'BF', Subject['exam']][] = [
			['Mathematik', 'mathe', 'LF', 'written'],
			['Physik', 'naturwissenschaft', 'LF', 'written'],
			['Englisch', 'fremdsprache', 'LF', 'written'],
			['Deutsch', 'deutsch', 'BF', 'oral'],
			['Geschichte', 'geschichte', 'BF', 'oral'],
			['Biologie', 'naturwissenschaft', 'BF', null],
			['Geographie', 'geographie', 'BF', null],
			['Gemeinschaftskunde', 'gemeinschaftskunde', 'BF', null],
			['Religion', 'religion_ethik', 'BF', null],
			['Bildende Kunst', 'kunst', 'BF', null],
			['Sport', 'sport', 'BF', null]
		];
		let d = emptyData();
		subjects.forEach(([name, category, level, exam], i) => {
			d = apply(d, {
				type: 'subject.upsert',
				subject: subject({ id: `s${i}`, name, category, level, exam, sortOrder: i })
			});
			d = apply(d, { type: 'zeugnis.set', subjectId: `s${i}`, halfYear: 1, points });
		});
		return d;
	}

	it('estimates open half-years and exams from the current grades', () => {
		const r = abiResult(fullSetup(11));
		expect(r.projected).toBe(true);
		expect(r.grade).not.toBeNull();
		// every open course and exam is estimated with the subject's 11 points, not a default
		expect(r.blockI.counted.every((c) => c.points === 11)).toBe(true);
		expect(r.blockII.exams.every((e) => e.points === 44)).toBe(true);
	});

	it('still answers the target question while the subject choice is incomplete', () => {
		let d = fullSetup(10);
		// only 32 courses left: the 40 courses for Block I can't be reached with any points
		for (const id of ['s6', 's7', 's8']) d = apply(d, { type: 'subject.delete', id });
		expect(abiResult(d).grade).toBeNull();
		const t = targetFor(d, 15);
		expect(t.incomplete).toBe(true);
		expect(t.impossible).toBe(false);
		expect(t.courses!.needed).toBeGreaterThan(10);
	});

	it('finds the average needed for a better grade', () => {
		const d = fullSetup(10);
		const now = abiResult(d);
		const t = targetFor(d, Math.round(now.grade! * 10) - 3);
		expect(t.reached).toBe(false);
		expect(t.missing).toBeGreaterThan(0);
		expect(t.courses!.needed).toBeGreaterThan(t.courses!.current);
		const easy = targetFor(d, 40);
		expect(easy.reached).toBe(true);
		const impossible = targetFor(fullSetup(0), 10);
		expect(impossible.impossible).toBe(true);
	});
});

describe('plannedNotifications', () => {
	it('plans only future reminders inside the horizon', () => {
		const now = new Date(2026, 10, 1, 12);
		const n = plannedNotifications(
			[
				ev({ start: '2026-11-20', reminders: [1440, 10080] }),
				ev({ id: 'old', start: '2026-10-01' })
			],
			now
		);
		expect(n).toHaveLength(2);
		expect(n[0]!.title).toBe('Klausur: Mathe');
	});
});
