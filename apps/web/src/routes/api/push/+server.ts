import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { pushSubscriptions } from '$lib/server/db/schema.ts';
import { getDb } from '$lib/server/instance.ts';
import { getVapidKeys } from '$lib/server/notify.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => json({ publicKey: getVapidKeys(getDb()).publicKey });

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const endpoint = body?.endpoint;
	const p256dh = body?.keys?.p256dh;
	const auth = body?.keys?.auth;
	if (
		typeof endpoint !== 'string' ||
		!endpoint.startsWith('https://') ||
		typeof p256dh !== 'string' ||
		typeof auth !== 'string'
	) {
		error(400, 'Invalid subscription');
	}
	getDb()
		.insert(pushSubscriptions)
		.values({ endpoint, p256dh, auth, createdAt: new Date() })
		.onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh, auth } })
		.run();
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (typeof body?.endpoint === 'string') {
		getDb().delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint)).run();
	}
	return json({ ok: true });
};
