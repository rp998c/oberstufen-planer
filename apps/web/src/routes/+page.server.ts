import { redirect } from '@sveltejs/kit';
import { HALF_YEARS, isValidPoints } from '@oberstufen-planer/abi-engine-bw';
import { toLocalDate } from '$lib/calendar.ts';
import { listEvents } from '$lib/server/events.ts';
import { tasks } from '$lib/server/db/schema.ts';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/instance.ts';
import { getPlan } from '$lib/server/plan.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const db = getDb();
	const { all, result } = getPlan(db);
	if (!all.subjects.length) redirect(303, '/einrichtung');

	const byKey = new Map(
		[...result.blockI.counted, ...result.blockI.notCounted].map((c) => [c.key, c])
	);
	const subjects = all.subjects
		.map((s) => {
			const points = HALF_YEARS.flatMap((h) => {
				const c = byKey.get(`${s.id}:${h}`);
				return c ? [{ halfYear: h, points: c.points, actual: c.actual }] : [];
			});
			const real = points.filter((p) => p.actual);
			const avg = points.length ? points.reduce((a, p) => a + p.points, 0) / points.length : null;
			return {
				id: s.id,
				name: s.name,
				color: s.color,
				level: s.level,
				points,
				avg,
				realCount: real.length
			};
		})
		.filter((s) => s.points.length > 0);

	const real = all.subjects.flatMap((s) =>
		HALF_YEARS.map((h) => s.courses[h]?.points).filter(isValidPoints)
	);
	const totalCourses = all.subjects.reduce((a, s) => a + Object.keys(s.courses).length, 0);

	const ranked = subjects.filter((s) => s.avg !== null).sort((a, b) => b.avg! - a.avg!);
	return {
		profile: all.profile,
		openTasks: db
			.select()
			.from(tasks)
			.where(eq(tasks.done, false))
			.orderBy(asc(tasks.due))
			.all()
			.slice(0, 3),
		nextEvents: listEvents(db)
			.filter((e) => (e.end ?? e.start).slice(0, 10) >= toLocalDate(new Date()))
			.slice(0, 4)
			.map((e) => ({
				...e,
				subject: all.subjects.find((s) => s.id === e.subjectId)?.name ?? null,
				color: all.subjects.find((s) => s.id === e.subjectId)?.color ?? null
			})),
		result: {
			total: result.total,
			blockI: result.blockI.points,
			blockII: result.blockII.points,
			unterkurse: result.blockI.unterkurse,
			unterkurseLF: result.blockI.unterkurseLF,
			grade: result.grade,
			gradeIgnoringConditions: result.gradeIgnoringConditions,
			passed: result.passed,
			projected: result.projected,
			issues: result.issues
		},
		zeugnisAvg: real.length ? real.reduce((a, b) => a + b, 0) / real.length : null,
		gradedCourses: real.length,
		totalCourses,
		subjects,
		strong: ranked.slice(0, 3).map((s) => s.id),
		weak: ranked.length > 3 ? ranked.slice(-3).map((s) => s.id) : []
	};
};
