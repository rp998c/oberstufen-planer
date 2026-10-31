export * from './types.ts';
export { gradeFromTotalPoints, formatGrade, MIN_TOTAL_POINTS, MAX_TOTAL_POINTS } from './grade.ts';
export { examBlockIIPoints } from './exam.ts';
export {
	AREAS,
	AREA_LABELS,
	DEFAULT_AREA_WEIGHTS,
	formatAreaWeights,
	halfYearPoints,
	parsePercent,
	type Area,
	type AreaResult,
	type AreaWeights,
	type GradeEntry,
	type GradeTypeInfo,
	type HalfYearPoints
} from './halfyear.ts';
export {
	DEFAULT_FORECAST,
	effectiveCoursePoints,
	effectiveExam,
	effectiveSubjectAverage,
	overallAverage,
	subjectAverage,
	type EffectivePoints
} from './forecast.ts';
export { validateSetup } from './setup.ts';
export {
	calculate,
	BLOCK_I_COURSES,
	type BlockIResult,
	type BlockIIResult,
	type CalculationResult,
	type CountedCourse,
	type ExamResultLine
} from './calculate.ts';
export { minTotalForGrade, requiredExamPoints, type TargetResult } from './target.ts';
