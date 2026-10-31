import { fail } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { listSubjects } from '$lib/server/data.ts';
import { tasks } from '$lib/server/db/schema.ts';
import { FormError, isoDateOrNull, str } from '$lib/server/form.ts';
import { getDb } from '$lib/server/instance.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const db = getDb();
	return {
		tasks: db
			.select()
			.from(tasks)
			.orderBy(asc(tasks.done), asc(tasks.due), asc(tasks.createdAt))
			.all(),
		subjects: listSubjects(db).map((s) => ({ id: s.id, name: s.name, color: s.color }))
	};
};

export const actions: Actions = {
	add: async ({ request }) => {
		const fd = await request.formData();
		try {
			const db = getDb();
			const subjectId = str(fd, 'subjectId') || null;
			if (subjectId && !listSubjects(db).some((s) => s.id === subjectId))
				throw new FormError('Unbekanntes Fach.');
			db.insert(tasks)
				.values({
					id: randomUUID(),
					title: str(fd, 'title', { required: true, max: 200, label: 'Aufgabe' }),
					subjectId,
					due: isoDateOrNull(fd, 'due'),
					createdAt: new Date()
				})
				.run();
			return { saved: true };
		} catch (e) {
			if (e instanceof FormError) return fail(400, { error: e.message });
			throw e;
		}
	},
	toggle: async ({ request }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		getDb()
			.update(tasks)
			.set({ done: fd.get('done') === 'true' })
			.where(eq(tasks.id, id))
			.run();
		return { saved: true };
	},
	delete: async ({ request }) => {
		const id = String((await request.formData()).get('id') ?? '');
		getDb().delete(tasks).where(eq(tasks.id, id)).run();
		return { saved: true };
	},
	clearDone: () => {
		getDb().delete(tasks).where(eq(tasks.done, true)).run();
		return { saved: true };
	}
};
