import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Pages of the old version (bookmarks): everything lives on the start page now. */
export const load: PageServerLoad = () => {
	redirect(307, '/');
};
