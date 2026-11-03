import { json } from '@sveltejs/kit';
import { OpError } from '@oberstufen-planer/app-core';
import { applyOps, getSnapshot } from '$lib/server/document.ts';
import { getDb } from '$lib/server/instance.ts';
import type { RequestHandler } from './$types';

/** GET ?since=<revision>: the whole document if anything changed since that revision. */
export const GET: RequestHandler = ({ url }) => {
	const snapshot = getSnapshot(getDb());
	const since = Number(url.searchParams.get('since') ?? -1);
	if (since === snapshot.revision) return json({ revision: snapshot.revision, changed: false });
	return json({ revision: snapshot.revision, changed: true, snapshot });
};

/** POST { ops: [{ opId, op }] }: applies queued changes in order. */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const db = getDb();
	try {
		const results = applyOps(db, body?.ops);
		return json({ revision: getSnapshot(db).revision, results });
	} catch (e) {
		if (e instanceof OpError) return json({ error: e.message }, { status: 400 });
		throw e;
	}
};
