import { json } from '@sveltejs/kit';
import { deleteSessionById, listAppSessions } from '$lib/server/auth.ts';
import { getDb } from '$lib/server/instance.ts';
import type { RequestHandler } from './$types';

/** Connected apps (Android). */
export const GET: RequestHandler = () =>
	json({
		devices: listAppSessions(getDb()).map((d) => ({
			id: d.id,
			name: d.name,
			kind: 'app',
			lastSeenAt: d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : null
		}))
	});

export const DELETE: RequestHandler = ({ url }) => {
	const id = url.searchParams.get('id') ?? '';
	const db = getDb();
	if (listAppSessions(db).some((d) => d.id === id)) deleteSessionById(db, id);
	return json({ ok: true });
};
