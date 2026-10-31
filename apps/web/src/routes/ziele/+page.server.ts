import { fail } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { HALF_YEARS } from '@oberstufen-planer/abi-engine-bw';
import { studyGoals } from '$lib/server/db/schema.ts';
import { FormError, intOrNull, isoDateOrNull, str } from '$lib/server/form.ts';
import { getDb } from '$lib/server/instance.ts';
import { getPlan } from '$lib/server/plan.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const db = getDb();
	const { all } = getPlan(db);
	return {
		goals: db
			.select()
			.from(studyGoals)
			.orderBy(asc(studyGoals.due), asc(studyGoals.createdAt))
			.all(),
		subjects: all.subjects.map((s) => {
			const values = HALF_YEARS.map((h) => s.courses[h]?.effective).filter(
				(v): v is number => typeof v === 'number'
			);
			return {
				id: s.id,
				name: s.name,
				color: s.color,
				average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
			};
		})
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

export const actions: Actions = {
	save: async ({ request }) => {
		const fd = await request.formData();
		return guard(() => {
			const db = getDb();
			const values = {
				title: str(fd, 'title', { required: true, max: 200, label: 'Lernziel' }),
				subjectId: str(fd, 'subjectId') || null,
				targetPoints: intOrNull(fd, 'targetPoints', 0, 15, 'Zielpunkte'),
				due: isoDateOrNull(fd, 'due')
			};
			const id = str(fd, 'id');
			if (id) db.update(studyGoals).set(values).where(eq(studyGoals.id, id)).run();
			else
				db.insert(studyGoals)
					.values({ id: randomUUID(), ...values, createdAt: new Date() })
					.run();
			return { saved: true };
		});
	},
	toggle: async ({ request }) => {
		const fd = await request.formData();
		getDb()
			.update(studyGoals)
			.set({ achieved: fd.get('achieved') === 'true' })
			.where(eq(studyGoals.id, String(fd.get('id') ?? '')))
			.run();
		return { saved: true };
	},
	delete: async ({ request }) => {
		const id = String((await request.formData()).get('id') ?? '');
		getDb().delete(studyGoals).where(eq(studyGoals.id, id)).run();
		return { saved: true };
	}
};
