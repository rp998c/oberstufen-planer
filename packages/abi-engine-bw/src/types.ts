export type HalfYear = 1 | 2 | 3 | 4;
export const HALF_YEARS: readonly HalfYear[] = [1, 2, 3, 4];

/**
 * Subject categories that matter for the BW rules. Source: KM BW, Leitfaden Abitur 2028,
 * 1.2.1–1.2.4 (Aufgabenfelder, Leistungsfächer, Basisfächer) and 1.5.2 (Block I).
 */
export type Category =
	| 'deutsch'
	| 'mathe'
	| 'fremdsprache'
	| 'naturwissenschaft' // Biologie, Chemie, Physik
	| 'nwt' // Naturwissenschaft und Technik
	| 'informatik'
	| 'geschichte'
	| 'geographie'
	| 'gemeinschaftskunde'
	| 'wirtschaft'
	| 'religion_ethik'
	| 'kunst'
	| 'musik'
	| 'sport'
	| 'seminarkurs'
	| 'sonstiges';

export const CATEGORY_LABELS: Record<Category, string> = {
	deutsch: 'Deutsch',
	mathe: 'Mathematik',
	fremdsprache: 'Fremdsprache',
	naturwissenschaft: 'Naturwissenschaft (Bio, Chemie, Physik)',
	nwt: 'Naturwissenschaft und Technik (NwT)',
	informatik: 'Informatik',
	geschichte: 'Geschichte',
	geographie: 'Geographie',
	gemeinschaftskunde: 'Gemeinschaftskunde',
	wirtschaft: 'Wirtschaft',
	religion_ethik: 'Religionslehre / Ethik',
	kunst: 'Bildende Kunst',
	musik: 'Musik',
	sport: 'Sport',
	seminarkurs: 'Seminarkurs',
	sonstiges: 'Sonstiges (Wahlbereich)'
};

/** LF = Leistungsfach (5-stündig, erhöhtes Niveau), BF = Basisfach. */
export type Level = 'LF' | 'BF';

/** Leistungsfächer are always examined in writing; two Basisfächer are examined orally. */
export type ExamKind = 'written' | 'oral' | null;

/**
 * One half-year course. `points` is the grade from the report card; `forecast` is the
 * user's own estimate for a course that has no grade yet. A missing entry in
 * `SubjectInput.courses` means the course is not taken in that half-year.
 */
export interface CourseInput {
	points?: number | null;
	forecast?: number | null;
}

export interface ExamInput {
	written?: number | null;
	oral?: number | null;
	writtenForecast?: number | null;
	oralForecast?: number | null;
}

export interface SubjectInput {
	id: string;
	name: string;
	category: Category;
	level: Level;
	exam: ExamKind;
	/** For foreign languages and NwT: started in Klasse 8 or earlier (needed for the requirements). */
	fromClass8?: boolean;
	courses: Partial<Record<HalfYear, CourseInput>>;
	examResult?: ExamInput;
}

/**
 * Besondere Lernleistung (e.g. Seminarkurs). It can count double in Block I (2 course
 * slots, max 30 points) or replace the oral exam of one Basisfach in Block II (×4).
 */
export interface BllInput {
	mode: 'none' | 'blockI' | 'blockII';
	points?: number | null;
	forecast?: number | null;
	/** Block II: the oral exam subject the BLL replaces. */
	replacesSubjectId?: string;
	/** The BLL is the Seminarkurs: its half-year courses can then not be counted separately. */
	fromSeminarkurs?: boolean;
}

export interface Overrides {
	/** The two Leistungsfächer that count double (subject ids). Default: the best choice. */
	doubled?: [string, string];
	/** Course keys (`subjectId:halfYear`) that must be counted. */
	include?: string[];
	/** Course keys that must not be counted. */
	exclude?: string[];
}

export interface PlanInput {
	subjects: SubjectInput[];
	bll?: BllInput;
	overrides?: Overrides;
}

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
	code: string;
	severity: Severity;
	message: string;
	subjectId?: string;
}

export function courseKey(subjectId: string, halfYear: HalfYear): string {
	return `${subjectId}:${halfYear}`;
}

export function isValidPoints(p: unknown): p is number {
	return typeof p === 'number' && Number.isInteger(p) && p >= 0 && p <= 15;
}
