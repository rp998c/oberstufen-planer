import { json } from '@sveltejs/kit';
import { getPasswordHash } from '$lib/server/auth.ts';
import { getConfig } from '$lib/server/config.ts';
import { getDb } from '$lib/server/instance.ts';
import type { RequestHandler } from './$types';

/** Lets the app check that an address really is a Oberstufen-Planer server. */
export const GET: RequestHandler = () => {
	const config = getConfig();
	return json({
		app: 'oberstufen-planer',
		api: 1,
		auth: config.auth,
		passwordSet: config.auth === 'none' || !!getPasswordHash(getDb(), config.passwordHash)
	});
};
