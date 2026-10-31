import { EVENT_KINDS, formatEventDate, parseLocal, type EventKind } from './calendar.ts';
import type { EventRow } from './snapshot.ts';

export interface PlannedNotification {
	/** Stable 31-bit id derived from event and reminder, so rescheduling replaces it. */
	id: number;
	at: Date;
	title: string;
	body: string;
}

function hash31(s: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 1 || 1;
}

/**
 * Reminders the phone should show itself (no push server needed). Only future ones within
 * `horizonDays`, at most `limit`, earliest first.
 */
export function plannedNotifications(
	events: EventRow[],
	now = new Date(),
	horizonDays = 60,
	limit = 60
): PlannedNotification[] {
	const end = now.getTime() + horizonDays * 86_400_000;
	const out: PlannedNotification[] = [];
	for (const e of events) {
		const start = parseLocal(e.start).getTime();
		for (const minutes of e.reminders) {
			const at = start - minutes * 60_000;
			if (at <= now.getTime() || at > end) continue;
			const kind = EVENT_KINDS[e.kind as EventKind] ?? 'Termin';
			out.push({
				id: hash31(`${e.id}:${minutes}`),
				at: new Date(at),
				title: `${kind}: ${e.title}`,
				body: formatEventDate(e.start, e.allDay)
			});
		}
	}
	return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, limit);
}
