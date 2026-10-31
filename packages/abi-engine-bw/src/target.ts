import { calculate, type CalculationResult } from './calculate.ts';
import { gradeFromTotalPoints } from './grade.ts';
import { isValidPoints, type PlanInput } from './types.ts';

/** Smallest total (300–900) that still gives the target grade or better, or null if impossible. */
export function minTotalForGrade(targetGrade: number): number | null {
	for (let total = 300; total <= 900; total++) {
		const grade = gradeFromTotalPoints(total);
		if (grade !== null && grade <= targetGrade + 1e-9) return total;
	}
	return null;
}

export interface TargetResult {
	/** Points (0–15) needed in every exam that has no result yet, or null if unreachable. */
	examPoints: number | null;
	/** Exams that are still open (subject ids). */
	openExams: string[];
	/** Calculation with the needed exam points filled in (or with 15 points if unreachable). */
	result: CalculationResult;
}

/**
 * "What do I need in the remaining exams for grade X?" Courses keep their real grades or
 * forecasts; every exam without a real result gets the same points, and the smallest value
 * that reaches the target grade (with all conditions met) is returned.
 */
export function requiredExamPoints(input: PlanInput, targetGrade: number): TargetResult {
	const open = input.subjects.filter((s) => {
		if (s.exam === 'written') return !isValidPoints(s.examResult?.written);
		if (s.exam === 'oral') {
			if (input.bll?.mode === 'blockII' && input.bll.replacesSubjectId === s.id) {
				return !isValidPoints(input.bll.points);
			}
			return !isValidPoints(s.examResult?.oral);
		}
		return false;
	});
	const openIds = new Set(open.map((s) => s.id));

	const withExamPoints = (x: number): PlanInput => ({
		...input,
		bll:
			input.bll?.mode === 'blockII' && !isValidPoints(input.bll.points)
				? { ...input.bll, forecast: x }
				: input.bll,
		subjects: input.subjects.map((s) => {
			if (!openIds.has(s.id)) return s;
			const r = s.examResult ?? {};
			return s.exam === 'written'
				? { ...s, examResult: { ...r, writtenForecast: x } }
				: { ...s, examResult: { ...r, oralForecast: x } };
		})
	});

	let last: CalculationResult | undefined;
	for (let x = 0; x <= 15; x++) {
		const result = calculate(withExamPoints(x));
		last = result;
		if (result.grade !== null && result.grade <= targetGrade + 1e-9) {
			return { examPoints: x, openExams: [...openIds], result };
		}
		if (!openIds.size) break;
	}
	return { examPoints: null, openExams: [...openIds], result: last! };
}
