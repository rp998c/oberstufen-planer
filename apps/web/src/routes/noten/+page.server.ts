import { redirect } from '@sveltejs/kit';
import { loadAll } from '$lib/server/data.ts';
import { getDb } from '$lib/server/instance.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const all = loadAll(getDb());
	if (!all.subjects.length) redirect(303, '/einrichtung');
	return { subjects: all.subjects };
};
