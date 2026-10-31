import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { SESSION_COOKIE, deleteExpiredSessions, validateSession } from '$lib/server/auth.ts';
import { getConfig } from '$lib/server/config.ts';
import { ensureDefaults } from '$lib/server/data.ts';
import { getDb } from '$lib/server/instance.ts';

/** Runs once at server start: fail fast on bad configuration and apply DB migrations. */
export const init: ServerInit = () => {
	const config = getConfig();
	deleteExpiredSessions(getDb());
	ensureDefaults(getDb());
	console.log(`Oberstufen-Planer started (AUTH=${config.auth}, DATA_DIR=${config.dataDir})`);
};

const PUBLIC_PATHS = new Set(['/login', '/healthz']);

export const handle: Handle = async ({ event, resolve }) => {
	const config = getConfig();

	if (config.auth === 'none') {
		event.locals.authenticated = true;
	} else {
		const token = event.cookies.get(SESSION_COOKIE);
		const session = token ? validateSession(getDb(), token, config.sessionDays) : null;
		if (token && session?.renewed) {
			event.cookies.set(SESSION_COOKIE, token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: event.url.protocol === 'https:',
				expires: session.expiresAt
			});
		}
		event.locals.authenticated = session !== null;
	}

	if (!event.locals.authenticated && !PUBLIC_PATHS.has(event.url.pathname)) {
		const target = event.url.pathname + event.url.search;
		redirect(303, target === '/' ? '/login' : `/login?redirectTo=${encodeURIComponent(target)}`);
	}

	const response = await resolve(event);
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	return response;
};
