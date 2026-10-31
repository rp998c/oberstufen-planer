import { json } from '@sveltejs/kit';
import { createSession, getPasswordHash, loginThrottle, verifyPassword } from '$lib/server/auth.ts';
import { getConfig } from '$lib/server/config.ts';
import { getDb } from '$lib/server/instance.ts';
import type { RequestHandler } from './$types';

/** App login: password + device name → long-lived bearer token. */
export const POST: RequestHandler = async ({ request }) => {
	const config = getConfig();
	const body = await request.json().catch(() => null);
	const device =
		typeof body?.device === 'string' ? body.device.trim().slice(0, 60) || 'Android' : 'Android';
	const db = getDb();
	if (config.auth === 'none') {
		return json({
			token: createSession(db, 3650, Date.now(), { kind: 'app', name: device }).token
		});
	}
	const hashValue = getPasswordHash(db, config.passwordHash);
	if (!hashValue)
		return json({ error: 'Bitte zuerst im Browser ein Passwort festlegen.' }, { status: 409 });
	if (loginThrottle.isLocked()) {
		return json(
			{ error: 'Zu viele Fehlversuche. Bitte in ein paar Minuten erneut versuchen.' },
			{ status: 429 }
		);
	}
	const password = typeof body?.password === 'string' ? body.password : '';
	if (!password || !(await verifyPassword(hashValue, password))) {
		loginThrottle.registerFailure();
		return json({ error: 'Falsches Passwort.' }, { status: 401 });
	}
	loginThrottle.reset();
	// app tokens last long; they are extended while the app is used and can be revoked in the settings
	const { token } = createSession(db, Math.max(config.sessionDays, 365), Date.now(), {
		kind: 'app',
		name: device
	});
	return json({ token });
};
