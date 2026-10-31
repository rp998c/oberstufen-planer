import { json } from '@sveltejs/kit';
import { OpError } from '@oberstufen-planer/app-core';
import { getDb } from '$lib/server/instance.ts';
import { applyOps, buildSnapshot, getRevision } from '$lib/server/sync.ts';
import type { RequestHandler } from './$types';

/** GET ?since=<revision>: the full data if anything changed since that revision. */
export const GET: RequestHandler = ({ url }) => {
	const db = getDb();
	const revision = getRevision(db);
	const since = Number(url.searchParams.get('since') ?? -1);
	if (since === revision) return json({ revision, changed: false });
	return json({ revision, changed: true, snapshot: buildSnapshot(db) });
};

/** POST { ops: [{ opId, op }] }: applies the app's queued changes in order. */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const db = getDb();
	try {
		const results = applyOps(db, body?.ops);
		return json({ revision: getRevision(db), results });
	} catch (e) {
		if (e instanceof OpError) return json({ error: e.message }, { status: 400 });
		throw e;
	}
};
