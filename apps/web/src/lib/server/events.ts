import { randomBytes, randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { getSetting, setSetting } from './data.ts';
import type { Db } from './db/index.ts';
import { events, sentReminders } from './db/schema.ts';
import type { IcalEvent } from './ical.ts';

export type EventRow = typeof events.$inferSelect;

export interface EventData {
	subjectId: string | null;
	title: string;
	kind: string;
	start: string;
	end: string | null;
	allDay: boolean;
	note: string;
	reminders: number[];
}

export function listEvents(db: Db): EventRow[] {
	return db.select().from(events).orderBy(asc(events.start)).all();
}

export function saveEvent(db: Db, id: string | null, data: EventData): string {
	if (id) {
		db.update(events).set(data).where(eq(events.id, id)).run();
		// changed time or reminders: allow reminders to fire again
		db.delete(sentReminders).where(eq(sentReminders.eventId, id)).run();
		return id;
	}
	const newId = randomUUID();
	db.insert(events)
		.values({ id: newId, ...data })
		.run();
	return newId;
}

export function deleteEvent(db: Db, id: string) {
	db.delete(events).where(eq(events.id, id)).run();
}

/**
 * Imports iCal events; events with a known UID are updated. Imported events get no
 * reminders (a school calendar would otherwise remind about every holiday).
 * Returns [created, updated].
 */
export function importEvents(db: Db, list: IcalEvent[]): [number, number] {
	let created = 0;
	let updated = 0;
	for (const e of list) {
		const existing = db.select().from(events).where(eq(events.externalUid, e.uid)).get();
		const values = { title: e.title, start: e.start, end: e.end, allDay: e.allDay, note: e.note };
		if (existing) {
			db.update(events).set(values).where(eq(events.id, existing.id)).run();
			updated++;
		} else {
			db.insert(events)
				.values({
					id: randomUUID(),
					kind: 'sonstiges',
					subjectId: null,
					reminders: [],
					externalUid: e.uid,
					...values
				})
				.run();
			created++;
		}
	}
	return [created, updated];
}

/** Secret token for the iCal feed URL (calendar apps can't log in). */
export function getFeedToken(db: Db, regenerate = false): string {
	let token = regenerate ? null : getSetting<string | null>(db, 'feedToken', null);
	if (!token) {
		token = randomBytes(24).toString('base64url');
		setSetting(db, 'feedToken', token);
	}
	return token;
}

export const getDefaultReminders = (db: Db) => getSetting<number[]>(db, 'reminderDefaults', [1440]);
