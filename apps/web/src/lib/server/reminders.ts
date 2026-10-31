import { parseLocal, formatEventDate, EVENT_KINDS, type EventKind } from '$lib/calendar.ts';
import type { Db } from './db/index.ts';
import { events, sentReminders } from './db/schema.ts';
import { notify } from './notify.ts';

export interface ReminderEvent {
	id: string;
	title: string;
	kind: string;
	start: string;
	allDay: boolean;
	reminders: number[];
}

/** Reminders older than this are skipped (e.g. after the server was down for a while). */
const MAX_LATE_MS = 12 * 60 * 60 * 1000;

/** Reminders that are due now and have not been sent yet. */
export function dueReminders(list: ReminderEvent[], sent: Set<string>, now: Date) {
	const due: { event: ReminderEvent; minutes: number }[] = [];
	for (const e of list) {
		const start = parseLocal(e.start).getTime();
		for (const minutes of e.reminders) {
			const at = start - minutes * 60_000;
			const late = now.getTime() - at;
			if (late >= 0 && late < MAX_LATE_MS && !sent.has(`${e.id}:${minutes}`)) {
				due.push({ event: e, minutes });
			}
		}
	}
	return due;
}

export async function runReminders(db: Db, now = new Date()) {
	const list = db.select().from(events).all();
	const sent = new Set(
		db
			.select()
			.from(sentReminders)
			.all()
			.map((r) => `${r.eventId}:${r.minutes}`)
	);
	for (const { event, minutes } of dueReminders(list, sent, now)) {
		// mark first: a failing channel must not cause a reminder storm
		db.insert(sentReminders)
			.values({ eventId: event.id, minutes, sentAt: now })
			.onConflictDoNothing()
			.run();
		const kind = EVENT_KINDS[event.kind as EventKind] ?? 'Termin';
		await notify(db, {
			title: `${kind}: ${event.title}`,
			body: formatEventDate(event.start, event.allDay),
			url: '/kalender'
		});
	}
}

let timer: ReturnType<typeof setInterval> | undefined;

export function startReminderLoop(db: Db) {
	if (timer) return;
	const tick = () => runReminders(db).catch((e) => console.error('Reminder loop failed', e));
	tick();
	timer = setInterval(tick, 60_000);
	timer.unref?.();
}
