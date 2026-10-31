import { fail, redirect } from '@sveltejs/kit';
import { verify } from '@node-rs/argon2';
import {
	LoginThrottle,
	SESSION_COOKIE,
	createSession,
	safeRedirectTarget
} from '$lib/server/auth.ts';
import { getConfig } from '$lib/server/config.ts';
import { getDb } from '$lib/server/instance.ts';
import type { Actions, PageServerLoad } from './$types';

const throttle = new LoginThrottle();

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.authenticated) redirect(303, safeRedirectTarget(url.searchParams.get('redirectTo')));
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const config = getConfig();
		if (config.auth === 'none') redirect(303, '/');

		if (throttle.isLocked()) {
			return fail(429, {
				error: 'Zu viele Fehlversuche. Bitte in ein paar Minuten erneut versuchen.'
			});
		}

		const password = (await request.formData()).get('password');
		if (typeof password !== 'string' || password.length === 0) {
			return fail(400, { error: 'Bitte das Passwort eingeben.' });
		}

		const ok = await verify(config.passwordHash, password).catch(() => false);
		if (!ok) {
			throttle.registerFailure();
			return fail(401, { error: 'Falsches Passwort.' });
		}

		throttle.reset();
		const { token, expiresAt } = createSession(getDb(), config.sessionDays);
		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			expires: expiresAt
		});
		redirect(303, safeRedirectTarget(url.searchParams.get('redirectTo')));
	}
};
