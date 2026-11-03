import { json } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/auth.ts';
import { getDb } from '$lib/server/instance.ts';
import type { RequestHandler } from './$types';

/** The app disconnects: its token stops working. */
export const POST: RequestHandler = ({ request }) => {
	const auth = request.headers.get('authorization');
	if (auth?.startsWith('Bearer ')) deleteSession(getDb(), auth.slice(7).trim());
	return json({ ok: true });
};
