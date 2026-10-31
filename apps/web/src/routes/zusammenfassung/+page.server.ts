import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/instance.ts';
import { getPlan, subjectMeta } from '$lib/server/plan.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { all, result } = getPlan(getDb());
	if (!all.subjects.length) redirect(303, '/einrichtung');
	return {
		subjects: subjectMeta(all),
		result,
		profile: all.profile,
		created: new Date().toISOString()
	};
};
