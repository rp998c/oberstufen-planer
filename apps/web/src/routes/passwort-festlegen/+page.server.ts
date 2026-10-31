import { fail, redirect } from '@sveltejs/kit';
import {
	MIN_PASSWORD_LENGTH,
	SESSION_COOKIE,
	createSession,
	getPasswordHash,
	setInitialPassword
} from '$lib/server/auth.ts';
import { getConfig } from '$lib/server/config.ts';
import { getDb } from '$lib/server/instance.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const config = getConfig();
	if (config.auth === 'none') redirect(303, '/');
	if (getPasswordHash(getDb(), config.passwordHash)) redirect(303, '/login');
	return { minLength: MIN_PASSWORD_LENGTH };
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const config = getConfig();
		const db = getDb();
		if (config.auth === 'none' || getPasswordHash(db, config.passwordHash)) redirect(303, '/login');

		const fd = await request.formData();
		const password = String(fd.get('password') ?? '');
		const repeat = String(fd.get('repeat') ?? '');
		if (password.length < MIN_PASSWORD_LENGTH) {
			return fail(400, {
				error: `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`
			});
		}
		if (password !== repeat) return fail(400, { error: 'Die Passwörter stimmen nicht überein.' });

		if (!(await setInitialPassword(db, password))) redirect(303, '/login');

		const { token, expiresAt } = createSession(db, config.sessionDays);
		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			expires: expiresAt
		});
		redirect(303, '/');
	}
};
