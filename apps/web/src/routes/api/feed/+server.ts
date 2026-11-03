import { json } from '@sveltejs/kit';
import { getFeedToken } from '$lib/server/document.ts';
import { getDb } from '$lib/server/instance.ts';
import type { RequestHandler } from './$types';

/** Path of the secret calendar feed (subscribe in Google, Apple, Outlook). */
export const GET: RequestHandler = () =>
	json({ path: `/kalender/feed/${getFeedToken(getDb())}.ics` });

/** New secret link; the old one stops working. */
export const POST: RequestHandler = () =>
	json({ path: `/kalender/feed/${getFeedToken(getDb(), true)}.ics` });
