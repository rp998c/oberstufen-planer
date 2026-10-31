import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, deleteSession } from '$lib/server/auth.ts';
import { getDb } from '$lib/server/instance.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) deleteSession(getDb(), token);
	cookies.delete(SESSION_COOKIE, { path: '/' });
	redirect(303, '/login');
};
