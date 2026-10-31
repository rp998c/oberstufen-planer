import { fail } from '@sveltejs/kit';
import { EVENT_KINDS, REMINDER_PRESETS } from '$lib/calendar.ts';
import { listSubjects } from '$lib/server/data.ts';
import {
	deleteEvent,
	getDefaultReminders,
	importEvents,
	listEvents,
	saveEvent
} from '$lib/server/events.ts';
import { FormError, isoDateOrNull, str } from '$lib/server/form.ts';
import { parseIcal } from '$lib/server/ical.ts';
import { getDb } from '$lib/server/instance.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const db = getDb();
	return {
		events: listEvents(db),
		subjects: listSubjects(db).map((s) => ({ id: s.id, name: s.name, color: s.color })),
		defaultReminders: getDefaultReminders(db)
	};
};

function guard<T>(fn: () => T) {
	try {
		return fn();
	} catch (e) {
		if (e instanceof FormError) return fail(400, { error: e.message });
		throw e;
	}
}

const MAX_ICS_BYTES = 2 * 1024 * 1024;

export const actions: Actions = {
	save: async ({ request }) => {
		const fd = await request.formData();
		return guard(() => {
			const db = getDb();
			const date = isoDateOrNull(fd, 'date');
			if (!date) throw new FormError('Bitte ein Datum eingeben.');
			const time = str(fd, 'time');
			if (time && !/^\d{2}:\d{2}$/.test(time))
				throw new FormError('Bitte eine gültige Uhrzeit eingeben.');
			const endDate = isoDateOrNull(fd, 'endDate');
			if (endDate && endDate < date) throw new FormError('Das Ende liegt vor dem Beginn.');
			const kind = str(fd, 'kind');
			if (!(kind in EVENT_KINDS)) throw new FormError('Ungültige Art.');
			const subjectId = str(fd, 'subjectId') || null;
			if (subjectId && !listSubjects(db).some((s) => s.id === subjectId))
				throw new FormError('Unbekanntes Fach.');
			const allowed = new Set<number>(REMINDER_PRESETS.map((p) => p.minutes));
			const reminders = fd
				.getAll('reminders')
				.map(Number)
				.filter((m) => allowed.has(m));
			saveEvent(db, str(fd, 'id') || null, {
				subjectId,
				title: str(fd, 'title', { required: true, max: 200, label: 'Titel' }),
				kind,
				start: time ? `${date}T${time}` : date,
				end: endDate && endDate !== date ? endDate : null,
				allDay: !time,
				note: str(fd, 'note', { max: 1000, label: 'Notiz' }),
				reminders
			});
			return { saved: true };
		});
	},
	delete: async ({ request }) => {
		const id = String((await request.formData()).get('id') ?? '');
		deleteEvent(getDb(), id);
		return { deleted: true };
	},
	import: async ({ request }) => {
		const fd = await request.formData();
		const db = getDb();
		let text = '';
		const file = fd.get('file');
		const url = String(fd.get('url') ?? '').trim();
		try {
			if (file instanceof File && file.size > 0) {
				if (file.size > MAX_ICS_BYTES) throw new FormError('Die Datei ist zu groß (max. 2 MB).');
				text = await file.text();
			} else if (url) {
				const parsed = new URL(url.replace(/^webcal:/i, 'https:'));
				if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
					throw new FormError('Bitte eine http(s)- oder webcal-Adresse angeben.');
				}
				const res = await fetch(parsed, { signal: AbortSignal.timeout(15_000) });
				if (!res.ok)
					throw new FormError(`Der Kalender konnte nicht geladen werden (HTTP ${res.status}).`);
				text = await res.text();
				if (text.length > MAX_ICS_BYTES)
					throw new FormError('Der Kalender ist zu groß (max. 2 MB).');
			} else {
				throw new FormError('Bitte eine .ics-Datei wählen oder eine Adresse angeben.');
			}
			if (!text.includes('BEGIN:VCALENDAR')) throw new FormError('Das ist keine iCal-Datei.');
			const list = parseIcal(text);
			const [created, updated] = importEvents(db, list);
			return { imported: { created, updated } };
		} catch (e) {
			if (e instanceof FormError) return fail(400, { error: e.message });
			if (e instanceof TypeError)
				return fail(400, { error: 'Ungültige Adresse oder Kalender nicht erreichbar.' });
			throw e;
		}
	}
};
