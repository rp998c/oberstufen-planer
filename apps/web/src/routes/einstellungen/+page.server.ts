import { fail } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getProfile, listGradeTypes, setSetting } from '$lib/server/data.ts';
import { gradeTypes, grades } from '$lib/server/db/schema.ts';
import { FormError, intOrNull, num, str } from '$lib/server/form.ts';
import { getDb } from '$lib/server/instance.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const db = getDb();
	const used = new Set(
		db
			.select({ id: grades.gradeTypeId })
			.from(grades)
			.all()
			.map((r) => r.id)
	);
	return {
		profile: getProfile(db),
		gradeTypes: listGradeTypes(db).map((t) => ({ ...t, used: used.has(t.id) }))
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
	profile: async ({ request }) => {
		const fd = await request.formData();
		return guard(() => {
			const db = getDb();
			setSetting(db, 'profile', {
				...getProfile(db),
				abiYear: intOrNull(fd, 'abiYear', 2020, 2100, 'Abiturjahr')
			});
			return { saved: 'profile' };
		});
	},
	saveType: async ({ request }) => {
		const fd = await request.formData();
		return guard(() => {
			const db = getDb();
			const id = str(fd, 'id');
			const values = {
				name: str(fd, 'name', { required: true, max: 40, label: 'Name' }),
				weight: num(fd, 'weight', 0, 10, 'Gewicht')
			};
			if (id) db.update(gradeTypes).set(values).where(eq(gradeTypes.id, id)).run();
			else
				db.insert(gradeTypes)
					.values({ id: randomUUID(), ...values, sortOrder: listGradeTypes(db).length })
					.run();
			return { saved: 'types' };
		});
	},
	deleteType: async ({ request }) => {
		const db = getDb();
		const id = String((await request.formData()).get('id') ?? '');
		const inUse = db.select().from(grades).where(eq(grades.gradeTypeId, id)).get();
		if (inUse) return fail(400, { error: 'Diese Notenart wird noch verwendet.' });
		db.delete(gradeTypes).where(eq(gradeTypes.id, id)).run();
		return { saved: 'types' };
	}
};
