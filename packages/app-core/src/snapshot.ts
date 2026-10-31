import type {
	Area,
	AreaWeights,
	BllInput,
	Category,
	ExamKind,
	Level,
	Overrides
} from '@oberstufen-planer/abi-engine-bw';

/** Rows as they are synced between server and app (timestamps as epoch milliseconds). */
export interface SubjectRow {
	id: string;
	name: string;
	category: Category;
	level: Level;
	exam: ExamKind;
	fromClass8: boolean;
	color: string;
	sortOrder: number;
	/** Own weighting of the areas, null = default from the settings. */
	areaWeights: AreaWeights | null;
}

export interface CourseRow {
	subjectId: string;
	halfYear: number;
	points: number | null;
	forecast: number | null;
}

export interface GradeTypeRow {
	id: string;
	name: string;
	/** Unused since per-subject weighting (#11). */
	weight: number;
	sortOrder: number;
	area: Area;
	/** Tests: all grades of this type together count like this many grades; null = each counts. */
	groupAs: number | null;
}

export interface GradeRow {
	id: string;
	subjectId: string;
	halfYear: number;
	gradeTypeId: string;
	points: number | null;
	forecast: number | null;
	weight: number;
	date: string | null;
	note: string;
}

export interface ExamRow {
	subjectId: string;
	written: number | null;
	oral: number | null;
	writtenForecast: number | null;
	oralForecast: number | null;
}

export interface EventRow {
	id: string;
	subjectId: string | null;
	title: string;
	kind: string;
	start: string;
	end: string | null;
	allDay: boolean;
	note: string;
	reminders: number[];
	externalUid: string | null;
}

export interface TaskRow {
	id: string;
	subjectId: string | null;
	title: string;
	due: string | null;
	done: boolean;
	createdAt: number;
}

export interface GoalRow {
	id: string;
	subjectId: string | null;
	title: string;
	targetPoints: number | null;
	due: string | null;
	achieved: boolean;
	createdAt: number;
}

export interface TimetableSlotRow {
	id: string;
	weekday: number;
	period: number;
	subjectId: string;
	room: string;
}

export interface SnapshotSettings {
	profile?: { abiYear: number | null };
	bll?: BllInput;
	overrides?: Overrides;
	reminderDefaults?: number[];
	timetable?: { periods: number; saturday: boolean };
	/** Default weighting of the areas for subjects without their own. */
	areaWeights?: AreaWeights;
}

export interface SnapshotData {
	subjects: SubjectRow[];
	courses: CourseRow[];
	gradeTypes: GradeTypeRow[];
	grades: GradeRow[];
	exams: ExamRow[];
	events: EventRow[];
	timetableSlots: TimetableSlotRow[];
	tasks: TaskRow[];
	studyGoals: GoalRow[];
}

/** Everything the app needs, plus the server revision it belongs to. */
export interface Snapshot {
	revision: number;
	settings: SnapshotSettings;
	data: SnapshotData;
}

export function emptySnapshot(): Snapshot {
	return {
		revision: 0,
		settings: {},
		data: {
			subjects: [],
			courses: [],
			gradeTypes: [],
			grades: [],
			exams: [],
			events: [],
			timetableSlots: [],
			tasks: [],
			studyGoals: []
		}
	};
}

/** Subjects in display order (same as the web app). */
export function sortedSubjects(subjects: SubjectRow[]): SubjectRow[] {
	return [...subjects].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
