import { describe, expect, it } from 'vitest';
import {
	OpError,
	applyOp,
	emptySnapshot,
	plannedNotifications,
	validateOp,
	type EventRow
} from './index.ts';

const ev = (over: Partial<EventRow>): EventRow => ({
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

describe('validateOp', () => {
	it('accepts valid and rejects invalid operations', () => {
		expect(() =>
			validateOp({ type: 'course.set', subjectId: 's1', halfYear: 2, points: 12 })
		).not.toThrow();
		expect(() =>
			validateOp({ type: 'course.set', subjectId: 's1', halfYear: 5, points: 12 })
		).toThrow(OpError);
		expect(() =>
			validateOp({ type: 'course.set', subjectId: 's1', halfYear: 2, points: 16 })
		).toThrow(/0 und 15/);
		expect(() => validateOp({ type: 'event.upsert', event: ev({ title: ' ' }) })).toThrow(/Titel/);
		expect(() =>
			validateOp({ type: 'event.upsert', event: ev({ start: '2026-11-20T08:00', allDay: true }) })
		).toThrow();
		expect(() => validateOp({ type: 'drop table' })).toThrow(/Unbekannte/);
		expect(() => validateOp(null)).toThrow();
	});
});

describe('applyOp', () => {
	it('ignores grades for courses that do not exist', () => {
		const s = emptySnapshot();
		const next = applyOp(s, {
			type: 'grade.upsert',
			grade: {
				id: 'g',
				subjectId: 'x',
				halfYear: 1,
				gradeTypeId: 't',
				points: 10,
				forecast: null,
				weight: 1,
				date: null,
				note: ''
			}
		});
		expect(next).toBe(s);
	});

	it('does not mutate the original snapshot', () => {
		const s = emptySnapshot();
		const next = applyOp(s, {
			type: 'task.upsert',
			task: { id: 't', subjectId: null, title: 'x', due: null, done: false, createdAt: 1 }
		});
		expect(s.data.tasks).toHaveLength(0);
		expect(next.data.tasks).toHaveLength(1);
	});
});

describe('plannedNotifications', () => {
	it('plans future reminders only, earliest first, with stable ids', () => {
		const now = new Date(2026, 10, 18, 12, 0);
		const list = plannedNotifications(
			[
				ev({ id: 'a', start: '2026-11-20', reminders: [1440, 2880] }),
				ev({ id: 'b', start: '2026-11-19T08:00', allDay: false, reminders: [60] }),
				ev({ id: 'c', start: '2027-06-01', reminders: [1440] })
			],
			now
		);
		expect(list.map((n) => n.at.toISOString())).toEqual([
			new Date(2026, 10, 19, 0, 0).toISOString(),
			new Date(2026, 10, 19, 7, 0).toISOString()
		]);
		expect(list[0]!.title).toBe('Klausur: Mathe');
		const again = plannedNotifications(
			[ev({ id: 'a', start: '2026-11-20', reminders: [1440, 2880] })],
			now
		);
		expect(again[0]!.id).toBe(list[0]!.id);
		expect(list[0]!.id).toBeGreaterThan(0);
		expect(list[0]!.id).toBeLessThan(2 ** 31);
	});
});
