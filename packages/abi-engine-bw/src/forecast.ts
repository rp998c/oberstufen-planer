import { HALF_YEARS, isValidPoints, type HalfYear, type SubjectInput } from './types.ts';

/** Used when nothing at all has been entered yet. */
export const DEFAULT_FORECAST = 8;

export interface EffectivePoints {
	points: number;
	/** true = real grade, false = forecast/estimate. */
	actual: boolean;
}

function roundHalfUp(x: number): number {
	return Math.floor(x + 0.5 + 1e-9);
}

/** Average of the real half-year grades of a subject, or null if there are none. */
export function subjectAverage(subject: SubjectInput): number | null {
	const pts = HALF_YEARS.map((h) => subject.courses[h]?.points).filter(isValidPoints);
	return pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : null;
}

/** Average of all real half-year grades, or null if there are none. */
export function overallAverage(subjects: SubjectInput[]): number | null {
	const pts = subjects.flatMap((s) =>
		HALF_YEARS.map((h) => s.courses[h]?.points).filter(isValidPoints)
	);
	return pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : null;
}

/**
 * Points of one course: the real grade, else the user's forecast, else the subject average,
 * else the overall average, else DEFAULT_FORECAST. Returns null if the course is not taken.
 */
export function effectiveCoursePoints(
	subject: SubjectInput,
	halfYear: HalfYear,
	fallbackAverage: number | null
): EffectivePoints | null {
	const course = subject.courses[halfYear];
	if (!course) return null;
	if (isValidPoints(course.points)) return { points: course.points, actual: true };
	if (isValidPoints(course.forecast)) return { points: course.forecast, actual: false };
	const avg = subjectAverage(subject) ?? fallbackAverage ?? DEFAULT_FORECAST;
	return { points: roundHalfUp(avg), actual: false };
}

/** Average of the effective course points (real or forecast) of a subject. */
export function effectiveSubjectAverage(
	subject: SubjectInput,
	fallbackAverage: number | null
): number {
	const pts = HALF_YEARS.map((h) => effectiveCoursePoints(subject, h, fallbackAverage)).filter(
		(p): p is EffectivePoints => p !== null
	);
	if (!pts.length) return fallbackAverage ?? DEFAULT_FORECAST;
	return pts.reduce((a, b) => a + b.points, 0) / pts.length;
}

/**
 * Exam points (0–15) of a subject: real result, else forecast, else the subject's course average.
 * The additional oral exam of a written subject only counts if a result or forecast is given.
 */
export function effectiveExam(
	subject: SubjectInput,
	fallbackAverage: number | null
): { written?: EffectivePoints; oral?: EffectivePoints } {
	const r = subject.examResult ?? {};
	const avg = roundHalfUp(effectiveSubjectAverage(subject, fallbackAverage));
	const pick = (actual: unknown, forecast: unknown, fallback?: number) => {
		if (isValidPoints(actual)) return { points: actual, actual: true };
		if (isValidPoints(forecast)) return { points: forecast, actual: false };
		return fallback === undefined ? undefined : { points: fallback, actual: false };
	};

	if (subject.exam === 'written') {
		return {
			written: pick(r.written, r.writtenForecast, avg),
			oral: pick(r.oral, r.oralForecast)
		};
	}
	if (subject.exam === 'oral') {
		return { oral: pick(r.oral, r.oralForecast, avg) };
	}
	return {};
}
