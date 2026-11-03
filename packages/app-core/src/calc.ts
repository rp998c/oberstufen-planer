import {
	HALF_YEARS,
	calculate,
	gradeFromTotalPoints,
	halfYearPoints,
	minTotalForGrade,
	type CalculationResult,
	type GradeTypeInfo,
	type HalfYear,
	type HalfYearPoints,
	type PlanInput,
	type SubjectInput
} from '@oberstufen-planer/abi-engine-bw';
import { sortedSubjects, type Data, type Grade, type Subject } from './model.ts';

/** How each grade kind counts in a subject (ids = grade kinds). */
export function gradeTypesFor(subject: Pick<Subject, 'tests'>): GradeTypeInfo[] {
	return [
		{ id: 'klausur', area: 'schriftlich' },
		{ id: 'gfs', area: 'schriftlich' },
		subject.tests === 'muendlich'
			? { id: 'test', area: 'muendlich' }
			: { id: 'test', area: 'schriftlich', groupAs: 1 },
		{ id: 'muendlich', area: 'muendlich' },
		{ id: 'praktisch', area: 'praktisch' }
	];
}

export type CourseSource = 'zeugnis' | 'noten' | 'offen';

export interface HalfYearView {
	halfYear: HalfYear;
	zeugnis: number | null;
	grades: Grade[];
	/** Calculated from the entered grades. */
	result: HalfYearPoints | null;
	/** Points used: report card, else calculated, else null (estimated by the engine). */
	effective: number | null;
	source: CourseSource;
}

export interface SubjectView {
	subject: Subject;
	/** null = subject not taken in that half-year. */
	halfYears: Record<HalfYear, HalfYearView | null>;
}

export function halfYearView(data: Data, subject: Subject, h: HalfYear): HalfYearView | null {
	if (!subject.halfYears.includes(h)) return null;
	const grades = data.grades
		.filter((g) => g.subjectId === subject.id && g.halfYear === h)
		.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
	const result = halfYearPoints(
		grades.map((g) => ({ points: g.points, typeId: g.kind })),
		gradeTypesFor(subject),
		subject.weights
	);
	const zeugnis =
		data.zeugnis.find((z) => z.subjectId === subject.id && z.halfYear === h)?.points ?? null;
	const source = zeugnis !== null ? 'zeugnis' : result ? 'noten' : 'offen';
	return {
		halfYear: h,
		zeugnis,
		grades,
		result,
		effective: zeugnis ?? result?.points ?? null,
		source
	};
}

export function subjectViews(data: Data): SubjectView[] {
	return sortedSubjects(data.subjects).map((subject) => ({
		subject,
		halfYears: Object.fromEntries(
			HALF_YEARS.map((h) => [h, halfYearView(data, subject, h)])
		) as SubjectView['halfYears']
	}));
}

/**
 * Engine input. Report-card grades are final; grades calculated from single grades count as
 * forecasts; half-years without anything are estimated from the subject's average (else the
 * overall average), so an open half-year is planned "as if the grades stay as they are".
 */
export function planInput(data: Data, views = subjectViews(data)): PlanInput {
	const known = views.flatMap((v) =>
		HALF_YEARS.map((h) => v.halfYears[h]?.effective).filter((p): p is number => p != null)
	);
	const overall = known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
	const subjects: SubjectInput[] = views.map((view) => {
		const { subject: s, halfYears } = view;
		const avg = subjectAverage(view) ?? overall;
		const courses: SubjectInput['courses'] = {};
		for (const h of HALF_YEARS) {
			const v = halfYears[h];
			if (!v) continue;
			const forecast =
				v.zeugnis !== null
					? null
					: (v.result?.points ?? (avg === null ? null : Math.floor(avg + 0.5)));
			courses[h] = { points: v.zeugnis, forecast };
		}
		const exam = data.exams.find((e) => e.subjectId === s.id);
		return {
			id: s.id,
			name: s.name,
			category: s.category,
			level: s.level,
			exam: s.exam,
			fromClass8: s.fromClass8,
			courses,
			examResult: exam ? { written: exam.written, oral: exam.oral } : undefined
		};
	});
	return { subjects, bll: data.bll };
}

export function abiResult(data: Data): CalculationResult {
	return calculate(planInput(data));
}

/** Average of the subject's known half-year points (report card or calculated), or null. */
export function subjectAverage(view: SubjectView): number | null {
	const pts = HALF_YEARS.map((h) => view.halfYears[h]?.effective).filter(
		(p): p is number => p != null
	);
	return pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : null;
}

export interface TargetResult {
	/** Target grade in tenths. */
	goal: number;
	minTotal: number | null;
	currentTotal: number;
	/** Points still missing (0 if already reached). */
	missing: number;
	/** Reached with the current estimates. */
	reached: boolean;
	/** Not reachable even with 15 points everywhere that is still open. */
	impossible: boolean;
	/**
	 * The admission conditions fail for reasons points can't fix (e.g. a compulsory subject is
	 * missing); the calculation then ignores the conditions.
	 */
	incomplete: boolean;
	/** Average needed in the courses still open, and the current estimate for them. */
	courses: { needed: number; current: number; count: number } | null;
	exams: { needed: number; current: number; count: number } | null;
}

const clamp = (x: number) => Math.max(0, Math.min(15, Math.round(x)));

/**
 * "What do I need for grade X?" Every course and exam that is not final yet is raised (or lowered)
 * by the same amount until the target is just reached.
 */
export function targetFor(data: Data, goal: number): TargetResult {
	const views = subjectViews(data);
	const base = planInput(data, views);
	const current = calculate(base);
	const minTotal = minTotalForGrade(goal / 10);

	const all = views.flatMap((v) =>
		HALF_YEARS.map((h) => v.halfYears[h]?.effective).filter((p): p is number => p != null)
	);
	const overall = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 8;

	// open slots with their current estimate
	const openCourses: { subjectId: string; h: HalfYear; base: number }[] = [];
	const openExams: { subjectId: string; kind: 'written' | 'oral'; base: number }[] = [];
	for (const v of views) {
		const avg = subjectAverage(v) ?? overall;
		for (const h of HALF_YEARS) {
			const hv = v.halfYears[h];
			if (hv && hv.zeugnis === null)
				openCourses.push({ subjectId: v.subject.id, h, base: hv.result?.points ?? avg });
		}
		const ex = data.exams.find((e) => e.subjectId === v.subject.id);
		if (v.subject.exam === 'written' && ex?.written == null)
			openExams.push({ subjectId: v.subject.id, kind: 'written', base: avg });
		if (v.subject.exam === 'oral' && ex?.oral == null)
			openExams.push({ subjectId: v.subject.id, kind: 'oral', base: avg });
	}

	const withShift = (d: number): PlanInput => ({
		...base,
		subjects: base.subjects.map((s) => {
			const courses = { ...s.courses };
			for (const c of openCourses.filter((c) => c.subjectId === s.id)) {
				courses[c.h] = { points: null, forecast: clamp(c.base + d) };
			}
			const ex = openExams.filter((e) => e.subjectId === s.id);
			const examResult = { ...(s.examResult ?? {}) };
			for (const e of ex) {
				if (e.kind === 'written') examResult.writtenForecast = clamp(e.base + d);
				else examResult.oralForecast = clamp(e.base + d);
			}
			return { ...s, courses, examResult };
		})
	});
	// conditions that even 15 points everywhere can't fix: compare the points only
	const incomplete = calculate(withShift(15)).grade === null;
	const gradeOf = (r: CalculationResult) => (incomplete ? r.gradeIgnoringConditions : r.grade);
	const ok = (d: number) => {
		const g = gradeOf(calculate(withShift(d)));
		return g !== null && g <= goal / 10 + 1e-9;
	};

	const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
	const summary = (d: number) => ({
		courses: openCourses.length
			? {
					needed: mean(openCourses.map((c) => clamp(c.base + d))),
					current: mean(openCourses.map((c) => c.base)),
					count: openCourses.length
				}
			: null,
		exams: openExams.length
			? {
					needed: mean(openExams.map((e) => clamp(e.base + d))),
					current: mean(openExams.map((e) => e.base)),
					count: openExams.length
				}
			: null
	});

	const currentGrade = gradeOf(current);
	const reached = currentGrade !== null && currentGrade <= goal / 10 + 1e-9;
	const result: TargetResult = {
		goal,
		minTotal,
		currentTotal: current.total,
		missing: minTotal === null ? 0 : Math.max(0, minTotal - current.total),
		reached,
		impossible: false,
		incomplete,
		...summary(0)
	};
	if (minTotal === null || (!openCourses.length && !openExams.length)) {
		return { ...result, impossible: !reached };
	}
	if (!ok(15)) return { ...result, impossible: true, ...summary(15) };
	// smallest shift (in steps of 0.1) that reaches the goal
	let lo = -15;
	let hi = 15;
	if (ok(lo)) return { ...result, ...summary(lo) };
	while (hi - lo > 0.1) {
		const mid = (lo + hi) / 2;
		if (ok(mid)) hi = mid;
		else lo = mid;
	}
	return { ...result, ...summary(hi) };
}

/** Grade from total points as "1,7" (or "–"). */
export function gradeText(total: number | null | undefined): string {
	const g = total == null ? null : gradeFromTotalPoints(total);
	return g === null ? '–' : g.toFixed(1).replace('.', ',');
}
