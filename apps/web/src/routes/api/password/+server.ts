import { json } from '@sveltejs/kit';
import {
	MIN_PASSWORD_LENGTH,
	SESSION_COOKIE,
	changePassword,
	deleteOtherSessions,
	getPasswordHash,
	verifyPassword
} from '$lib/server/auth.ts';
import { getConfig } from '$lib/server/config.ts';
import { getDb } from '$lib/server/instance.ts';
import type { RequestHandler } from './$types';

/** Changes the password and signs out all other browsers and apps. */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const config = getConfig();
	if (config.auth === 'none' || config.passwordHash) {
		return json(
			{ error: 'Das Passwort wird über die Umgebungsvariable APP_PASSWORD_HASH verwaltet.' },
			{ status: 400 }
		);
	}
	const body = await request.json().catch(() => null);
	const current = typeof body?.current === 'string' ? body.current : '';
	const next = typeof body?.next === 'string' ? body.next : '';
	const db = getDb();
	const hashValue = getPasswordHash(db, '');
	if (!hashValue || !(await verifyPassword(hashValue, current))) {
		return json({ error: 'Das aktuelle Passwort ist falsch.' }, { status: 400 });
	}
	if (next.length < MIN_PASSWORD_LENGTH) {
		return json({ error: `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.` }, { status: 400 });
	}
	await changePassword(db, next);
	const token = cookies.get(SESSION_COOKIE);
	if (token) deleteOtherSessions(db, token);
	return json({ ok: true });
};
