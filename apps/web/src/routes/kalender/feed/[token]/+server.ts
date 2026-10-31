import { error } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { getFeedToken, listEvents } from '$lib/server/events.ts';
import { buildIcal } from '$lib/server/ical.ts';
import { getDb } from '$lib/server/instance.ts';
import type { RequestHandler } from './$types';

/** Public iCal feed, protected by the secret token in the URL ("…/feed/<token>.ics"). */
export const GET: RequestHandler = ({ params }) => {
	const db = getDb();
	const given = Buffer.from(params.token.replace(/\.ics$/, ''));
	const expected = Buffer.from(getFeedToken(db));
	if (given.length !== expected.length || !timingSafeEqual(given, expected))
		error(404, 'Not found');
	const body = buildIcal(listEvents(db));
	return new Response(body, {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': 'inline; filename="oberstufen-planer.ics"',
			'Cache-Control': 'no-store'
		}
	});
};
