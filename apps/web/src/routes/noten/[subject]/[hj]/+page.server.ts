import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { createGrade, loadAll, setCourse, updateGrade, type GradeData } from '$lib/server/data.ts';
import { grades } from '$lib/server/db/schema.ts';
import { FormError, halfYear, intOrNull, isoDateOrNull, num, str } from '$lib/server/form.ts';
import { getDb } from '$lib/server/instance.ts';
import type { Actions, PageServerLoad } from './$types';

function context(params: { subject: string; hj: string }) {
	const db = getDb();
	const all = loadAll(db);
	const subject = all.subjects.find((s) => s.id === params.subject);
	let h;
	try {
		h = halfYear(params.hj);
	} catch {
		error(404, 'Halbjahr nicht gefunden');
	}
	if (!subject || !subject.courses[h]) error(404, 'Kurs nicht gefunden');
	return { db, all, subject, h };
}

export const load: PageServerLoad = ({ params }) => {
	const { all, subject, h } = context(params);
	return {
		subject,
		halfYear: h,
		course: subject.courses[h]!,
		grades: all.grades.filter((g) => g.subjectId === subject.id && g.halfYear === h),
		gradeTypes: all.gradeTypes
	};
};

function parseGrade(fd: FormData, subjectId: string, h: GradeData['halfYear']): GradeData {
	const open = fd.get('open') === 'on';
	const value = intOrNull(fd, 'value', 0, 15, 'Punkte');
	if (!open && value === null)
		throw new FormError('Bitte Punkte eingeben oder „noch offen“ wählen.');
	return {
		subjectId,
		halfYear: h,
		gradeTypeId: str(fd, 'gradeTypeId', { required: true, label: 'Art' }),
		points: open ? null : value,
		forecast: open ? value : null,
		weight: num(fd, 'weight', 0.1, 10, 'Gewicht'),
		date: isoDateOrNull(fd, 'date'),
		note: str(fd, 'note', { max: 200, label: 'Notiz' })
	};
}

function guard<T>(fn: () => T) {
	try {
		return fn();
	} catch (e) {
		if (e instanceof FormError) return fail(400, { error: e.message });
		throw e;
	}
}

export const actions: Actions = {
	addGrade: async ({ request, params }) => {
		const { db, all, subject, h } = context(params);
		const fd = await request.formData();
		return guard(() => {
			const data = parseGrade(fd, subject.id, h);
			if (!all.gradeTypes.some((t) => t.id === data.gradeTypeId))
				throw new FormError('Unbekannte Notenart.');
			createGrade(db, data);
			return { saved: true };
		});
	},
	updateGrade: async ({ request, params }) => {
		const { db, subject, h } = context(params);
		const fd = await request.formData();
		return guard(() => {
			const id = str(fd, 'id', { required: true });
			const owned = db
				.select()
				.from(grades)
				.where(and(eq(grades.id, id), eq(grades.subjectId, subject.id), eq(grades.halfYear, h)))
				.get();
			if (!owned) throw new FormError('Note nicht gefunden.');
			updateGrade(db, id, parseGrade(fd, subject.id, h));
			return { saved: true };
		});
	},
	deleteGrade: async ({ request, params }) => {
		const { db, subject, h } = context(params);
		const id = String((await request.formData()).get('id') ?? '');
		db.delete(grades)
			.where(and(eq(grades.id, id), eq(grades.subjectId, subject.id), eq(grades.halfYear, h)))
			.run();
		return { saved: true };
	},
	course: async ({ request, params }) => {
		const { db, subject, h } = context(params);
		const fd = await request.formData();
		return guard(() => {
			setCourse(db, subject.id, h, {
				points: intOrNull(fd, 'points', 0, 15, 'Zeugnisnote'),
				forecast: intOrNull(fd, 'forecast', 0, 15, 'Prognose')
			});
			return { saved: true };
		});
	}
};
