import {
	DEFAULT_AREA_WEIGHTS,
	type AreaWeights,
	type BllInput,
	type Category,
	type ExamKind,
	type HalfYear,
	type Level
} from '@oberstufen-planer/abi-engine-bw';

/**
 * The whole user data as one document. The app keeps it on the device; a server is optional
 * and only stores and syncs the same document.
 */

export type GradeKind = 'klausur' | 'test' | 'gfs' | 'muendlich' | 'praktisch';
export const GRADE_KINDS: readonly GradeKind[] = [
	'klausur',
	'test',
	'gfs',
	'muendlich',
	'praktisch'
];
export const GRADE_KIND_LABELS: Record<GradeKind, string> = {
	klausur: 'Klausur',
	test: 'Test',
	gfs: 'GFS',
	muendlich: 'Mündlich',
	praktisch: 'Praktisch'
};

/** How tests count: not used, all together like one Klausur, or each as an oral grade. */
export type TestMode = 'none' | 'klausur' | 'muendlich';
export const TEST_MODE_LABELS: Record<TestMode, string> = {
	none: 'keine',
	klausur: 'wie 1 Klausur',
	muendlich: 'zu mündlich'
};

export interface Subject {
	id: string;
	name: string;
	color: string;
	category: Category;
	level: Level;
	exam: ExamKind;
	/** Foreign languages / NwT: started in Klasse 8 or earlier. */
	fromClass8: boolean;
	sortOrder: number;
	/** Half-years the subject is taken in. */
	halfYears: HalfYear[];
	/** Klausuren per half-year (LF usually 2, BF 1). */
	klausuren: number;
	tests: TestMode;
	/** Weighting of schriftlich / mündlich / praktisch (relative; 0 = the subject has no such part). */
	weights: AreaWeights;
}

/** Grade from the report card for one half-year. */
export interface ReportGrade {
	subjectId: string;
	halfYear: HalfYear;
	points: number;
}

export interface Grade {
	id: string;
	subjectId: string;
	halfYear: HalfYear;
	kind: GradeKind;
	points: number;
	date: string | null;
	note: string;
}

export interface ExamResult {
	subjectId: string;
	written: number | null;
	/** For an oral exam subject the exam; for a written one the optional extra oral exam. */
	oral: number | null;
}

export type EventKind = 'klausur' | 'test' | 'gfs' | 'abi' | 'sonstiges';

export interface CalEvent {
	id: string;
	subjectId: string | null;
	title: string;
	kind: EventKind;
	/** "YYYY-MM-DD" (all day) or "YYYY-MM-DDTHH:mm", local time. */
	start: string;
	end: string | null;
	allDay: boolean;
	note: string;
	/** Minutes before the start. */
	reminders: number[];
	/** UID from an imported calendar, so a second import updates instead of duplicating. */
	externalUid: string | null;
}

export interface Data {
	version: 2;
	profile: { abiYear: number | null };
	/** Target grade in tenths (15 = 1,5), or null. */
	goal: number | null;
	bll: BllInput;
	subjects: Subject[];
	zeugnis: ReportGrade[];
	grades: Grade[];
	exams: ExamResult[];
	events: CalEvent[];
}

/** The document plus the server revision it belongs to (0 = never synced). */
export interface Snapshot {
	revision: number;
	data: Data;
}

export function emptyData(): Data {
	return {
		version: 2,
		profile: { abiYear: null },
		goal: null,
		bll: { mode: 'none' },
		subjects: [],
		zeugnis: [],
		grades: [],
		exams: [],
		events: []
	};
}

export function emptySnapshot(): Snapshot {
	return { revision: 0, data: emptyData() };
}

export function sortedSubjects(subjects: Subject[]): Subject[] {
	return [...subjects].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export const HALF_YEAR_SHORT: Record<HalfYear, string> = {
	1: 'J1 · 1',
	2: 'J1 · 2',
	3: 'J2 · 1',
	4: 'J2 · 2'
};
export const HALF_YEAR_LONG: Record<HalfYear, string> = {
	1: 'J1 · 1. Halbjahr',
	2: 'J1 · 2. Halbjahr',
	3: 'J2 · 1. Halbjahr',
	4: 'J2 · 2. Halbjahr'
};

/**
 * Half-year a date belongs to, from the Abitur year: J1 starts in August two years before.
 * Half-years change on 1 February. Before J1 → 1, after J2 → 4.
 */
export function halfYearOf(date: string, abiYear: number | null): HalfYear {
	if (!abiYear) return 1;
	const y = Number(date.slice(0, 4));
	const m = Number(date.slice(5, 7));
	// months since August of (abiYear - 2)
	const months = (y - (abiYear - 2)) * 12 + (m - 8);
	if (months < 6) return 1;
	if (months < 12) return 2;
	if (months < 18) return 3;
	return 4;
}

export function todayLocal(now = new Date()): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Default settings for a new subject. */
export function defaultGrading(
	category: Category,
	level: Level
): Pick<Subject, 'klausuren' | 'tests' | 'weights'> {
	if (category === 'sport') {
		return {
			klausuren: 0,
			tests: 'none',
			weights: { schriftlich: 30, muendlich: 0, praktisch: 70 }
		};
	}
	return {
		klausuren: level === 'LF' ? 2 : 1,
		tests: 'none',
		weights: { ...DEFAULT_AREA_WEIGHTS }
	};
}
