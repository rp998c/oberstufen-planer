import { error, fail, redirect } from '@sveltejs/kit';
import { SUBJECT_COLORS } from '$lib/subjects.ts';
import {
	createSubject,
	deleteSubject,
	listSubjects,
	loadAll,
	updateSubject,
	type SubjectData
} from '$lib/server/data.ts';
import { FormError, bool, category, color, halfYearList, str } from '$lib/server/form.ts';
import { getDb } from '$lib/server/instance.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const db = getDb();
	if (params.id === 'neu') {
		return {
			isNew: true,
			subject: {
				name: '',
				category: 'sonstiges',
				level: 'BF',
				exam: null,
				fromClass8: true,
				color: SUBJECT_COLORS[listSubjects(db).length % SUBJECT_COLORS.length]!,
				halfYears: [1, 2, 3, 4]
			} satisfies SubjectData,
			gradeCount: 0
		};
	}
	const all = loadAll(db);
	const s = all.subjects.find((x) => x.id === params.id);
	if (!s) error(404, 'Fach nicht gefunden');
	return {
		isNew: false,
		subject: {
			name: s.name,
			category: s.category,
			level: s.level,
			exam: s.exam,
			fromClass8: s.fromClass8,
			color: s.color,
			halfYears: Object.values(s.courses).map((c) => c.halfYear)
		} satisfies SubjectData,
		gradeCount: all.grades.filter((g) => g.subjectId === s.id).length
	};
};

function parse(fd: FormData): SubjectData {
	const level = fd.get('level') === 'LF' ? 'LF' : 'BF';
	const halfYears = halfYearList(fd.getAll('halfYears'));
	if (!halfYears.length) throw new FormError('Bitte mindestens ein Halbjahr wählen.');
	return {
		name: str(fd, 'name', { required: true, max: 60, label: 'Name' }),
		category: category(fd.get('category')),
		level,
		exam: level === 'LF' ? 'written' : bool(fd, 'oral') ? 'oral' : null,
		fromClass8: bool(fd, 'fromClass8'),
		color: color(fd.get('color')),
		halfYears
	};
}

export const actions: Actions = {
	save: async ({ request, params }) => {
		const db = getDb();
		try {
			const data = parse(await request.formData());
			if (params.id === 'neu') createSubject(db, data);
			else updateSubject(db, params.id, data);
		} catch (e) {
			if (e instanceof FormError) return fail(400, { error: e.message });
			throw e;
		}
		redirect(303, '/faecher');
	},
	delete: ({ params }) => {
		if (params.id !== 'neu') deleteSubject(getDb(), params.id);
		redirect(303, '/faecher');
	}
};
