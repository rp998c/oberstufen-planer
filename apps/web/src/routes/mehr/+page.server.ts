import { eq } from 'drizzle-orm';
import { tasks, studyGoals } from '$lib/server/db/schema.ts';
import { getDb } from '$lib/server/instance.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const db = getDb();
	return {
		openTasks: db.select().from(tasks).where(eq(tasks.done, false)).all().length,
		openGoals: db.select().from(studyGoals).where(eq(studyGoals.achieved, false)).all().length
	};
};
