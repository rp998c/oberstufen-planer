import { exportData } from '$lib/server/backup.ts';
import { getDb } from '$lib/server/instance.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const date = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(exportData(getDb()), null, 2), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="oberstufen-planer-${date}.json"`,
			'Cache-Control': 'no-store'
		}
	});
};
