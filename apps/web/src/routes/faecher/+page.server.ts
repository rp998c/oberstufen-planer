import { validateSetup } from '@oberstufen-planer/abi-engine-bw';
import { loadAll, toPlanInput } from '$lib/server/data.ts';
import { getDb } from '$lib/server/instance.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const all = loadAll(getDb());
	return {
		subjects: all.subjects,
		issues: all.subjects.length ? validateSetup(toPlanInput(all)) : [],
		justCreated: url.searchParams.has('neu')
	};
};
