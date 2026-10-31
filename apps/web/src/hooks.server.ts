import { json, redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	deleteExpiredSessions,
	getPasswordHash,
	validateSession
} from '$lib/server/auth.ts';
import { getConfig } from '$lib/server/config.ts';
import { ensureDefaults } from '$lib/server/data.ts';
import { getDb } from '$lib/server/instance.ts';
import { startReminderLoop } from '$lib/server/reminders.ts';

/** Runs once at server start: fail fast on bad configuration and apply DB migrations. */
export const init: ServerInit = () => {
	const config = getConfig();
	deleteExpiredSessions(getDb());
	ensureDefaults(getDb());
	startReminderLoop(getDb());
	console.log(`Oberstufen-Planer started (AUTH=${config.auth}, DATA_DIR=${config.dataDir})`);
	if (config.auth === 'password' && !getPasswordHash(getDb(), config.passwordHash)) {
		console.log('Noch kein Passwort festgelegt – beim ersten Aufruf der App wird danach gefragt.');
	}
};

const PUBLIC_PATHS = new Set([
	'/login',
	'/healthz',
	'/passwort-festlegen',
	'/api/app/info',
	'/api/app/login'
]);
const SETUP_PATH = '/passwort-festlegen';

export const handle: Handle = async ({ event, resolve }) => {
	const config = getConfig();

	if (config.auth === 'none') {
		event.locals.authenticated = true;
	} else if (!getPasswordHash(getDb(), config.passwordHash)) {
		// first start: nobody can log in yet, everything leads to the set-password page
		event.locals.authenticated = false;
		if (!PUBLIC_PATHS.has(event.url.pathname) || event.url.pathname === '/login') {
			if (event.url.pathname.startsWith('/api/')) {
				return json({ error: 'Bitte zuerst im Browser ein Passwort festlegen.' }, { status: 409 });
			}
			redirect(303, SETUP_PATH);
		}
	} else if (event.request.headers.get('authorization')?.startsWith('Bearer ')) {
		// Android app
		const token = event.request.headers.get('authorization')!.slice(7).trim();
		event.locals.authenticated = validateSession(getDb(), token, config.sessionDays) !== null;
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

	const isPublic =
		PUBLIC_PATHS.has(event.url.pathname) || event.url.pathname.startsWith('/kalender/feed/');
	if (!event.locals.authenticated && !isPublic && event.url.pathname.startsWith('/api/')) {
		return json({ error: 'Nicht angemeldet.' }, { status: 401 });
	}
	if (!event.locals.authenticated && !isPublic) {
		const target = event.url.pathname + event.url.search;
		redirect(303, target === '/' ? '/login' : `/login?redirectTo=${encodeURIComponent(target)}`);
	}

	const response = await resolve(event);
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	return response;
};
