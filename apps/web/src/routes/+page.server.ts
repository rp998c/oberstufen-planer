import { redirect } from '@sveltejs/kit';
import { calculate } from '@oberstufen-planer/abi-engine-bw';
import { loadAll, toPlanInput } from '$lib/server/data.ts';
import { getDb } from '$lib/server/instance.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const all = loadAll(getDb());
	if (!all.subjects.length) redirect(303, '/einrichtung');
	const result = calculate(toPlanInput(all));
	return {
		profile: all.profile,
		result: {
			total: result.total,
			blockI: result.blockI.points,
			blockII: result.blockII.points,
			grade: result.grade,
			gradeIgnoringConditions: result.gradeIgnoringConditions,
			projected: result.projected,
			issues: result.issues
		}
	};
};
