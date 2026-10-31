import { fail, redirect } from '@sveltejs/kit';
import type { BllInput, Overrides } from '@oberstufen-planer/abi-engine-bw';
import { getOverrides, setExam, setSetting } from '$lib/server/data.ts';
import { FormError, bool, intOrNull, str } from '$lib/server/form.ts';
import { getDb } from '$lib/server/instance.ts';
import { getPlan, subjectMeta } from '$lib/server/plan.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { all, input, result } = getPlan(getDb());
	if (!all.subjects.length) redirect(303, '/einrichtung');
	return {
		subjects: subjectMeta(all),
		exams: all.subjects
			.filter((s) => s.exam !== null)
			.map((s) => ({ id: s.id, exam: s.exam, result: s.examResult })),
		input,
		result,
		bll: all.bll,
		overrides: all.overrides
	};
};

function guard<T>(fn: () => T) {
	try {
		return fn();
	} catch (e) {
		if (e instanceof FormError) return fail(400, { error: e.message });
		throw e;
	}
}

export const actions: Actions = {
	exam: async ({ request }) => {
		const fd = await request.formData();
		return guard(() => {
			const db = getDb();
			const subjectId = str(fd, 'subjectId', { required: true });
			const { all } = getPlan(db);
			const s = all.subjects.find((x) => x.id === subjectId && x.exam !== null);
			if (!s) throw new FormError('Prüfungsfach nicht gefunden.');
			setExam(db, subjectId, {
				written: s.exam === 'written' ? intOrNull(fd, 'written', 0, 15, 'Schriftlich') : null,
				oral: intOrNull(fd, 'oral', 0, 15, 'Mündlich'),
				writtenForecast:
					s.exam === 'written'
						? intOrNull(fd, 'writtenForecast', 0, 15, 'Prognose schriftlich')
						: null,
				oralForecast: intOrNull(fd, 'oralForecast', 0, 15, 'Prognose mündlich')
			});
			return { saved: `exam-${subjectId}` };
		});
	},
	bll: async ({ request }) => {
		const fd = await request.formData();
		return guard(() => {
			const db = getDb();
			const mode = str(fd, 'mode');
			if (mode !== 'none' && mode !== 'blockI' && mode !== 'blockII') {
				throw new FormError('Ungültige Auswahl.');
			}
			const bll: BllInput = {
				mode,
				points: intOrNull(fd, 'points', 0, 15, 'Punkte'),
				forecast: intOrNull(fd, 'forecast', 0, 15, 'Prognose'),
				replacesSubjectId: str(fd, 'replacesSubjectId') || undefined,
				fromSeminarkurs: bool(fd, 'fromSeminarkurs')
			};
			setSetting(db, 'bll', bll);
			return { saved: 'bll' };
		});
	},
	/** Cycle a course between automatic, always counted and never counted. */
	course: async ({ request }) => {
		const fd = await request.formData();
		return guard(() => {
			const db = getDb();
			const key = str(fd, 'key', { required: true });
			const state = str(fd, 'state');
			if (!/^[\w-]+:[1-4]$/.test(key)) throw new FormError('Ungültiger Kurs.');
			const o: Overrides = getOverrides(db);
			const include = new Set(o.include ?? []);
			const exclude = new Set(o.exclude ?? []);
			include.delete(key);
			exclude.delete(key);
			if (state === 'include') include.add(key);
			if (state === 'exclude') exclude.add(key);
			setSetting(db, 'overrides', { ...o, include: [...include], exclude: [...exclude] });
			return { saved: 'course' };
		});
	},
	doubled: async ({ request }) => {
		const fd = await request.formData();
		return guard(() => {
			const db = getDb();
			const o: Overrides = getOverrides(db);
			const ids = fd.getAll('doubled').map(String);
			if (ids.length === 0) {
				delete o.doubled;
			} else if (ids.length === 2) {
				o.doubled = [ids[0]!, ids[1]!];
			} else {
				throw new FormError(
					'Bitte genau zwei Leistungsfächer wählen – oder keins für automatisch.'
				);
			}
			setSetting(db, 'overrides', o);
			return { saved: 'doubled' };
		});
	},
	resetOverrides: () => {
		setSetting(getDb(), 'overrides', {});
		return { saved: 'reset' };
	}
};
