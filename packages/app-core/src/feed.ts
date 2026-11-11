import { EVENT_KINDS } from './calendar.ts';
import type { FeedEvent } from './ical.ts';
import type { CalEvent, Data } from './model.ts';

/** School entries without a time are shown in the school day instead of all day. */
const SCHOOL_DAY = { start: '08:00', end: '14:00' } as const;
const SCHOOL_KINDS = new Set<CalEvent['kind']>(['klausur', 'test', 'gfs', 'abi']);

/**
 * Calendar entries as they appear in the subscribed feed:
 * "Mathe Klausur 2/8", "Deutsch GFS", Klausuren etc. from 8 to 14 Uhr.
 */
export function feedEvents(data: Data): FeedEvent[] {
	const subjects = new Map(data.subjects.map((s) => [s.id, s]));
	const byStart = (a: CalEvent, b: CalEvent) =>
		a.start.localeCompare(b.start) || a.id.localeCompare(b.id);

	// number the Klausuren of each subject in date order
	const number = new Map<string, string>();
	for (const s of data.subjects) {
		const list = data.events.filter((e) => e.kind === 'klausur' && e.subjectId === s.id);
		list.sort(byStart);
		const total = Math.max(list.length, s.klausuren * s.halfYears.length);
		list.forEach((e, i) => number.set(e.id, ` ${i + 1}/${total}`));
	}

	return data.events.map((e) => {
		const subject = e.subjectId ? subjects.get(e.subjectId) : undefined;
		let title = e.title;
		if (subject) {
			const own = e.title.trim();
			const custom = own && own !== subject.name && own !== EVENT_KINDS[e.kind] ? own : '';
			title =
				e.kind === 'sonstiges'
					? custom
						? `${subject.name}: ${custom}`
						: subject.name
					: `${subject.name} ${EVENT_KINDS[e.kind]}${number.get(e.id) ?? ''}` +
						(custom ? ` – ${custom}` : '');
		}
		if (e.allDay && !e.end && SCHOOL_KINDS.has(e.kind)) {
			const day = e.start.slice(0, 10);
			const shift = 8 * 60; // reminders were meant relative to midnight
			return {
				id: e.id,
				title,
				start: `${day}T${SCHOOL_DAY.start}`,
				end: `${day}T${SCHOOL_DAY.end}`,
				allDay: false,
				note: e.note,
				reminders: e.reminders.map((m) => m + shift)
			};
		}
		return {
			id: e.id,
			title,
			start: e.start,
			end: e.end,
			allDay: e.allDay,
			note: e.note,
			reminders: e.reminders
		};
	});
}
