import { fail, redirect } from '@sveltejs/kit';
import { HALF_YEARS, isValidPoints, type HalfYear } from '@oberstufen-planer/abi-engine-bw';
import { setCourse, setExam } from '$lib/server/data.ts';
import { courses, exams } from '$lib/server/db/schema.ts';
import { getDb } from '$lib/server/instance.ts';
import { getPlan, subjectMeta } from '$lib/server/plan.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { all, input, result } = getPlan(getDb());
	if (!all.subjects.length) redirect(303, '/einrichtung');
	return {
		subjects: subjectMeta(all),
		input,
		baseline: { total: result.total, grade: result.gradeIgnoringConditions },
		/** Courses whose value is a real report-card grade. */
		zeugnis: all.subjects.flatMap((s) =>
			HALF_YEARS.filter((h) => s.courses[h]?.source === 'zeugnis').map((h) => `${s.id}:${h}`)
		)
	};
};

interface SavePayload {
	courses: { subjectId: string; halfYear: number; forecast: number }[];
	exams: { subjectId: string; written?: number; oral?: number }[];
}

export const actions: Actions = {
	save: async ({ request }) => {
		const db = getDb();
		let payload: SavePayload;
		try {
			payload = JSON.parse(String((await request.formData()).get('payload') ?? ''));
		} catch {
			return fail(400, { error: 'Ungültige Eingabe.' });
		}
		const { all } = getPlan(db);
		let saved = 0;
		for (const c of payload.courses ?? []) {
			const s = all.subjects.find((x) => x.id === c.subjectId);
			const course = s?.courses[c.halfYear as HalfYear];
			// report-card grades are fixed; only forecasts can be saved
			if (!course || course.source === 'zeugnis' || !isValidPoints(c.forecast)) continue;
			setCourse(db, c.subjectId, c.halfYear as HalfYear, { forecast: c.forecast });
			saved++;
		}
		for (const e of payload.exams ?? []) {
			const s = all.subjects.find((x) => x.id === e.subjectId);
			if (!s || !s.exam) continue;
			const values: { writtenForecast?: number; oralForecast?: number } = {};
			if (s.exam === 'written' && isValidPoints(e.written) && s.examResult?.written == null)
				values.writtenForecast = e.written;
			if (isValidPoints(e.oral) && s.examResult?.oral == null) values.oralForecast = e.oral;
			if (Object.keys(values).length) {
				setExam(db, s.id, values);
				saved++;
			}
		}
		return { saved };
	},
	reset: () => {
		const db = getDb();
		db.update(courses).set({ forecast: null }).run();
		db.update(exams).set({ writtenForecast: null, oralForecast: null }).run();
		return { reset: true };
	}
};
