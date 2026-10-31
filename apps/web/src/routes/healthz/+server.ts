import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { getDb } from '$lib/server/instance.ts';

export function GET() {
	try {
		getDb().get(sql`select 1`);
		return json({ status: 'ok' });
	} catch (error) {
		console.error('Health check failed', error);
		return json({ status: 'error' }, { status: 503 });
	}
}
