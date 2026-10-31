import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import {
	DEFAULT_AREA_WEIGHTS,
	HALF_YEARS,
	type Area,
	type AreaWeights,
	type BllInput,
	type Category,
	type ExamKind,
	type HalfYear,
	type Level,
	type Overrides,
	type PlanInput,
	type SubjectInput
} from '@oberstufen-planer/abi-engine-bw';
import { courseView, subjectWeights, type CourseView } from '@oberstufen-planer/app-core';
import type { Db } from './db/index.ts';
import { courses, exams, gradeTypes, grades, settings, subjects } from './db/schema.ts';

export type SubjectRow = typeof subjects.$inferSelect;
export type CourseRow = typeof courses.$inferSelect;
export type GradeRow = typeof grades.$inferSelect;
export type GradeTypeRow = typeof gradeTypes.$inferSelect;
export type ExamRow = typeof exams.$inferSelect;

export interface Profile {
	abiYear: number | null;
}

export const DEFAULT_GRADE_TYPES: { name: string; area: Area; groupAs: number | null }[] = [
	{ name: 'Klausur', area: 'schriftlich', groupAs: null },
	{ name: 'Test', area: 'schriftlich', groupAs: 1 },
	{ name: 'Mündlich / Mitarbeit', area: 'muendlich', groupAs: null },
	{ name: 'GFS', area: 'schriftlich', groupAs: null },
	{ name: 'Praktisch', area: 'praktisch', groupAs: null }
];

// ---- settings ---------------------------------------------------------------------------

export function getSetting<T>(db: Db, key: string, fallback: T): T {
	const row = db.select().from(settings).where(eq(settings.key, key)).get();
	return row ? (row.value as T) : fallback;
}

export function setSetting(db: Db, key: string, value: unknown) {
	db.insert(settings)
		.values({ key, value })
		.onConflictDoUpdate({ target: settings.key, set: { value } })
		.run();
}

export const getProfile = (db: Db) => getSetting<Profile>(db, 'profile', { abiYear: null });
export const getBll = (db: Db) => getSetting<BllInput>(db, 'bll', { mode: 'none' });
export const getOverrides = (db: Db) => getSetting<Overrides>(db, 'overrides', {});
/** Default weighting of the areas for subjects without their own. */
export const getAreaWeights = (db: Db) =>
	getSetting<AreaWeights>(db, 'areaWeights', DEFAULT_AREA_WEIGHTS);

/** Creates the default grade types on first start. */
export function ensureDefaults(db: Db) {
	if (db.select().from(gradeTypes).all().length === 0) {
		DEFAULT_GRADE_TYPES.forEach((t, i) =>
			db
				.insert(gradeTypes)
				.values({ id: randomUUID(), name: t.name, area: t.area, groupAs: t.groupAs, sortOrder: i })
				.run()
		);
	}
}

// ---- subjects ---------------------------------------------------------------------------

export interface SubjectData {
	name: string;
	category: Category;
	level: Level;
	exam: ExamKind;
	fromClass8: boolean;
	color: string;
	halfYears: HalfYear[];
	/** Own weighting; null = default; undefined = leave unchanged. */
	areaWeights?: AreaWeights | null;
}

export function listSubjects(db: Db): SubjectRow[] {
	return db.select().from(subjects).orderBy(asc(subjects.sortOrder), asc(subjects.name)).all();
}

export function createSubject(db: Db, data: SubjectData): string {
	const id = randomUUID();
	const sortOrder = listSubjects(db).length;
	db.transaction((tx) => {
		const { halfYears, ...rest } = data;
		tx.insert(subjects)
			.values({ id, ...rest, sortOrder })
			.run();
		for (const h of halfYears) tx.insert(courses).values({ subjectId: id, halfYear: h }).run();
	});
	return id;
}

export function updateSubject(db: Db, id: string, data: SubjectData) {
	db.transaction((tx) => {
		const { halfYears, ...rest } = data;
		tx.update(subjects).set(rest).where(eq(subjects.id, id)).run();
		const existing = tx.select().from(courses).where(eq(courses.subjectId, id)).all();
		for (const c of existing) {
			if (!halfYears.includes(c.halfYear as HalfYear)) {
				tx.delete(grades)
					.where(and(eq(grades.subjectId, id), eq(grades.halfYear, c.halfYear)))
					.run();
			}
		}
		const keep = new Map(existing.map((c) => [c.halfYear, c]));
		tx.delete(courses).where(eq(courses.subjectId, id)).run();
		for (const h of halfYears) {
			const old = keep.get(h);
			tx.insert(courses)
				.values({
					subjectId: id,
					halfYear: h,
					points: old?.points ?? null,
					forecast: old?.forecast ?? null
				})
				.run();
		}
	});
}

export function deleteSubject(db: Db, id: string) {
	db.delete(subjects).where(eq(subjects.id, id)).run();
}

// ---- courses, grades, exams -------------------------------------------------------------

export function setCourse(
	db: Db,
	subjectId: string,
	halfYear: HalfYear,
	values: { points?: number | null; forecast?: number | null }
) {
	db.insert(courses)
		.values({ subjectId, halfYear, points: null, forecast: null, ...values })
		.onConflictDoUpdate({ target: [courses.subjectId, courses.halfYear], set: values })
		.run();
}

export interface GradeData {
	subjectId: string;
	halfYear: HalfYear;
	gradeTypeId: string;
	points: number | null;
	forecast: number | null;
	weight: number;
	date: string | null;
	note: string;
}

export function createGrade(db: Db, data: GradeData): string {
	const id = randomUUID();
	db.insert(grades)
		.values({ id, ...data })
		.run();
	return id;
}

export function updateGrade(db: Db, id: string, data: Partial<GradeData>) {
	db.update(grades).set(data).where(eq(grades.id, id)).run();
}

export function deleteGrade(db: Db, id: string) {
	db.delete(grades).where(eq(grades.id, id)).run();
}

export function listGradeTypes(db: Db): GradeTypeRow[] {
	return db.select().from(gradeTypes).orderBy(asc(gradeTypes.sortOrder)).all();
}

export function setExam(db: Db, subjectId: string, values: Partial<Omit<ExamRow, 'subjectId'>>) {
	db.insert(exams)
		.values({ subjectId, ...values })
		.onConflictDoUpdate({ target: exams.subjectId, set: values })
		.run();
}

// ---- view model -------------------------------------------------------------------------

export { courseView, type CourseSource, type CourseView } from '@oberstufen-planer/app-core';

export interface SubjectView extends SubjectRow {
	category: Category;
	level: Level;
	exam: ExamKind;
	/** Weighting used for this subject (own or default). */
	weights: AreaWeights;
	courses: Partial<Record<HalfYear, CourseView>>;
	examResult: ExamRow | null;
}

export interface AllData {
	profile: Profile;
	subjects: SubjectView[];
	gradeTypes: GradeTypeRow[];
	grades: GradeRow[];
	bll: BllInput;
	overrides: Overrides;
	/** Default weighting of the areas. */
	areaWeights: AreaWeights;
}

export function loadAll(db: Db): AllData {
	const types = listGradeTypes(db);
	const typeRows = types as unknown as import('@oberstufen-planer/app-core').GradeTypeRow[];
	const defaults = getAreaWeights(db);
	const allGrades = db.select().from(grades).orderBy(asc(grades.date)).all();
	const allCourses = db.select().from(courses).all();
	const allExams = db.select().from(exams).all();

	const subjectViews: SubjectView[] = listSubjects(db).map((s) => {
		const weights = subjectWeights(s, defaults);
		const cs: SubjectView['courses'] = {};
		for (const c of allCourses.filter((c) => c.subjectId === s.id)) {
			const g = allGrades.filter((g) => g.subjectId === s.id && g.halfYear === c.halfYear);
			cs[c.halfYear as HalfYear] = courseView(c, g, typeRows, weights);
		}
		return {
			...s,
			weights,
			category: s.category as Category,
			level: s.level as Level,
			exam: (s.exam as ExamKind) ?? null,
			courses: cs,
			examResult: allExams.find((e) => e.subjectId === s.id) ?? null
		};
	});

	return {
		profile: getProfile(db),
		subjects: subjectViews,
		gradeTypes: types,
		grades: allGrades,
		bll: getBll(db),
		overrides: getOverrides(db),
		areaWeights: defaults
	};
}

/** Maps the stored data to the engine input. Report-card grades are real; everything else is a forecast. */
export function toPlanInput(data: AllData): PlanInput {
	const subjectsInput: SubjectInput[] = data.subjects.map((s) => {
		const cs: SubjectInput['courses'] = {};
		for (const h of HALF_YEARS) {
			const c = s.courses[h];
			if (!c) continue;
			cs[h] = {
				points: c.points,
				forecast: c.source === 'zeugnis' ? null : c.effective
			};
		}
		return {
			id: s.id,
			name: s.name,
			category: s.category,
			level: s.level,
			exam: s.exam,
			fromClass8: s.fromClass8,
			courses: cs,
			examResult: s.examResult
				? {
						written: s.examResult.written,
						oral: s.examResult.oral,
						writtenForecast: s.examResult.writtenForecast,
						oralForecast: s.examResult.oralForecast
					}
				: undefined
		};
	});
	return { subjects: subjectsInput, bll: data.bll, overrides: data.overrides };
}
