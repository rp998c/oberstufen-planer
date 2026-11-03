import { error } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { buildIcal } from '@oberstufen-planer/app-core';
import { getFeedToken, getSnapshot } from '$lib/server/document.ts';
import { getDb } from '$lib/server/instance.ts';
import type { RequestHandler } from './$types';

/** Public iCal feed, protected by the secret token in the URL ("…/feed/<token>.ics"). */
export const GET: RequestHandler = ({ params }) => {
	const db = getDb();
	const given = Buffer.from(params.token.replace(/\.ics$/, ''));
	const expected = Buffer.from(getFeedToken(db));
	if (given.length !== expected.length || !timingSafeEqual(given, expected))
		error(404, 'Not found');
	const data = getSnapshot(db).data;
	const name = (id: string | null) => data.subjects.find((s) => s.id === id)?.name;
	const events = data.events.map((e) => ({
		...e,
		title:
			name(e.subjectId) && e.title !== name(e.subjectId)
				? `${name(e.subjectId)}: ${e.title}`
				: e.title
	}));
	return new Response(buildIcal(events), {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': 'inline; filename="oberstufen-planer.ics"',
			'Cache-Control': 'no-store'
		}
	});
};
