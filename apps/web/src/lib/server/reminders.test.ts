import { describe, expect, it } from 'vitest';
import { dueReminders, type ReminderEvent } from './reminders.ts';

const ev = (over: Partial<ReminderEvent>): ReminderEvent => ({
	id: 'e',
	title: 'Klausur',
	kind: 'klausur',
	start: '2026-11-20',
	allDay: true,
	reminders: [1440],
	...over
});

describe('dueReminders', () => {
	it('fires once the reminder time has passed', () => {
		const list = [ev({})];
		expect(dueReminders(list, new Set(), new Date(2026, 10, 18, 23, 59))).toHaveLength(0);
		expect(dueReminders(list, new Set(), new Date(2026, 10, 19, 0, 0))).toHaveLength(1);
	});

	it('does not fire twice', () => {
		expect(dueReminders([ev({})], new Set(['e:1440']), new Date(2026, 10, 19, 0, 1))).toHaveLength(
			0
		);
	});

	it('skips reminders that are more than 12 hours late', () => {
		expect(dueReminders([ev({})], new Set(), new Date(2026, 10, 19, 13, 0))).toHaveLength(0);
	});

	it('handles timed events and several reminders', () => {
		const list = [ev({ start: '2026-11-20T08:00', allDay: false, reminders: [60, 1440] })];
		const due = dueReminders(list, new Set(), new Date(2026, 10, 20, 7, 5));
		expect(due.map((d) => d.minutes)).toEqual([60]);
	});

	it('"am Vortag, 18 Uhr" for all-day entries', () => {
		const due = dueReminders([ev({ reminders: [360] })], new Set(), new Date(2026, 10, 19, 18, 0));
		expect(due).toHaveLength(1);
	});
});
