import { fail, redirect } from '@sveltejs/kit';
import { SUBJECT_COLORS, SUBJECT_PRESETS } from '$lib/subjects.ts';
import { createSubject, getProfile, listSubjects, setSetting } from '$lib/server/data.ts';
import { FormError, category, halfYearList } from '$lib/server/form.ts';
import { getDb } from '$lib/server/instance.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const db = getDb();
	return {
		presets: SUBJECT_PRESETS,
		hasSubjects: listSubjects(db).length > 0,
		profile: getProfile(db)
	};
};

interface Payload {
	abiYear: number | null;
	subjects: {
		name: string;
		category: string;
		level: 'LF' | 'BF';
		exam: 'written' | 'oral' | null;
		fromClass8: boolean;
		halfYears: number[];
	}[];
}

export const actions: Actions = {
	default: async ({ request }) => {
		const db = getDb();
		if (listSubjects(db).length > 0) {
			return fail(409, {
				error: 'Die Fächer sind schon angelegt. Änderungen bitte unter „Fächer“.'
			});
		}
		let payload: Payload;
		try {
			payload = JSON.parse(String((await request.formData()).get('payload') ?? ''));
		} catch {
			return fail(400, { error: 'Ungültige Eingabe.' });
		}

		try {
			const year = payload.abiYear;
			if (year !== null && (!Number.isInteger(year) || year < 2020 || year > 2100)) {
				throw new FormError('Bitte ein gültiges Abiturjahr eingeben.');
			}
			if (!Array.isArray(payload.subjects) || payload.subjects.length === 0) {
				throw new FormError('Bitte mindestens ein Fach auswählen.');
			}
			const cleaned = payload.subjects.map((s, i) => {
				const name = String(s.name ?? '').trim();
				if (!name || name.length > 60)
					throw new FormError('Jedes Fach braucht einen Namen (max. 60 Zeichen).');
				const level = s.level === 'LF' ? 'LF' : 'BF';
				const exam = level === 'LF' ? 'written' : s.exam === 'oral' ? 'oral' : null;
				const halfYears = halfYearList(Array.isArray(s.halfYears) ? s.halfYears : []);
				if (!halfYears.length)
					throw new FormError(`${name}: bitte mindestens ein Halbjahr wählen.`);
				return {
					name,
					category: category(s.category),
					level,
					exam,
					fromClass8: s.fromClass8 !== false,
					color: SUBJECT_COLORS[i % SUBJECT_COLORS.length]!,
					halfYears
				} as const;
			});

			setSetting(db, 'profile', { ...getProfile(db), abiYear: year });
			for (const s of cleaned) createSubject(db, s);
		} catch (e) {
			if (e instanceof FormError) return fail(400, { error: e.message });
			throw e;
		}
		redirect(303, '/faecher?neu=1');
	}
};
