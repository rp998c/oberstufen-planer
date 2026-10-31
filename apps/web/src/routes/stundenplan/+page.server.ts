import { fail } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getSetting, listSubjects, setSetting } from '$lib/server/data.ts';
import { timetableSlots } from '$lib/server/db/schema.ts';
import { FormError, intOrNull, str } from '$lib/server/form.ts';
import { getDb } from '$lib/server/instance.ts';
import type { Actions, PageServerLoad } from './$types';

export interface TimetableConfig {
	periods: number;
	saturday: boolean;
}

export const load: PageServerLoad = () => {
	const db = getDb();
	return {
		slots: db.select().from(timetableSlots).all(),
		subjects: listSubjects(db).map((s) => ({ id: s.id, name: s.name, color: s.color })),
		config: getSetting<TimetableConfig>(db, 'timetable', { periods: 10, saturday: false })
	};
};

export const actions: Actions = {
	slot: async ({ request }) => {
		const fd = await request.formData();
		try {
			const db = getDb();
			const weekday = intOrNull(fd, 'weekday', 1, 6, 'Wochentag');
			const period = intOrNull(fd, 'period', 1, 14, 'Stunde');
			if (weekday === null || period === null) throw new FormError('Ungültige Stunde.');
			const subjectId = str(fd, 'subjectId');
			const where = and(eq(timetableSlots.weekday, weekday), eq(timetableSlots.period, period));
			if (!subjectId) {
				db.delete(timetableSlots).where(where).run();
				return { saved: true };
			}
			if (!listSubjects(db).some((s) => s.id === subjectId))
				throw new FormError('Unbekanntes Fach.');
			const room = str(fd, 'room', { max: 20, label: 'Raum' });
			db.insert(timetableSlots)
				.values({ id: randomUUID(), weekday, period, subjectId, room })
				.onConflictDoUpdate({
					target: [timetableSlots.weekday, timetableSlots.period],
					set: { subjectId, room }
				})
				.run();
			return { saved: true };
		} catch (e) {
			if (e instanceof FormError) return fail(400, { error: e.message });
			throw e;
		}
	},
	config: async ({ request }) => {
		const fd = await request.formData();
		try {
			const periods = intOrNull(fd, 'periods', 4, 14, 'Stunden pro Tag') ?? 10;
			setSetting(getDb(), 'timetable', { periods, saturday: fd.get('saturday') === 'on' });
			return { saved: true };
		} catch (e) {
			if (e instanceof FormError) return fail(400, { error: e.message });
			throw e;
		}
	}
};
