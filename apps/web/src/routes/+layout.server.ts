import { getConfig } from '$lib/server/config.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	authenticated: locals.authenticated,
	canLogout: getConfig().auth === 'password'
});
