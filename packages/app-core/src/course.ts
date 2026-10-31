import {
	DEFAULT_AREA_WEIGHTS,
	halfYearPoints,
	type AreaWeights,
	type HalfYear,
	type HalfYearPoints
} from '@oberstufen-planer/abi-engine-bw';
import type { CourseRow, GradeRow, GradeTypeRow } from './snapshot.ts';

/** Where the effective half-year points come from. */
export type CourseSource = 'zeugnis' | 'prognose' | 'noten' | 'offen';

export interface CourseView {
	halfYear: HalfYear;
	/** Report-card grade. */
	points: number | null;
	/** Own estimate. */
	forecast: number | null;
	/** Calculated from the entered grades only. */
	fromGrades: HalfYearPoints | null;
	/** Calculated from entered grades plus forecasts of open grades. */
	fromGradesProjected: HalfYearPoints | null;
	gradeCount: number;
	openCount: number;
	source: CourseSource;
	/** Points used for the calculation (null = the engine fills in the average). */
	effective: number | null;
}

/** Report-card grade, else own forecast, else calculated from the single grades. */
export function courseView(
	course: CourseRow,
	courseGrades: GradeRow[],
	types: GradeTypeRow[],
	weights: AreaWeights = DEFAULT_AREA_WEIGHTS
): CourseView {
	const actual = courseGrades.filter((g) => g.points !== null);
	const withForecasts = courseGrades
		.map((g) => ({ ...g, p: g.points ?? g.forecast }))
		.filter((g) => g.p !== null);
	const typeInfo = types.map((t) => ({ id: t.id, area: t.area, groupAs: t.groupAs }));
	const fromGrades = halfYearPoints(
		actual.map((g) => ({ points: g.points!, typeId: g.gradeTypeId, weight: g.weight })),
		typeInfo,
		weights
	);
	const fromGradesProjected = halfYearPoints(
		withForecasts.map((g) => ({ points: g.p!, typeId: g.gradeTypeId, weight: g.weight })),
		typeInfo,
		weights
	);

	let source: CourseSource = 'offen';
	let effective: number | null = null;
	if (course.points !== null) {
		source = 'zeugnis';
		effective = course.points;
	} else if (course.forecast !== null) {
		source = 'prognose';
		effective = course.forecast;
	} else if (fromGradesProjected) {
		source = 'noten';
		effective = fromGradesProjected.points;
	}

	return {
		halfYear: course.halfYear as HalfYear,
		points: course.points,
		forecast: course.forecast,
		fromGrades,
		fromGradesProjected,
		gradeCount: actual.length,
		openCount: courseGrades.length - actual.length,
		source,
		effective
	};
}
