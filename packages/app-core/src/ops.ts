import type {
	CourseRow,
	EventRow,
	ExamRow,
	GoalRow,
	GradeRow,
	Snapshot,
	TaskRow
} from './snapshot.ts';

/**
 * Changes the app makes while offline. They are applied to the local snapshot at once
 * and sent to the server later; the server applies them in order (last write wins).
 * New rows get their id from the app, so later operations can refer to them.
 */
export type Op =
	| { type: 'grade.upsert'; grade: GradeRow }
	| { type: 'grade.delete'; id: string }
	| {
			type: 'course.set';
			subjectId: string;
			halfYear: number;
			points?: number | null;
			forecast?: number | null;
	  }
	| {
			type: 'exam.set';
			subjectId: string;
			written?: number | null;
			oral?: number | null;
			writtenForecast?: number | null;
			oralForecast?: number | null;
	  }
	| { type: 'event.upsert'; event: Omit<EventRow, 'externalUid'> }
	| { type: 'event.delete'; id: string }
	| { type: 'task.upsert'; task: TaskRow }
	| { type: 'task.delete'; id: string }
	| { type: 'goal.upsert'; goal: GoalRow }
	| { type: 'goal.delete'; id: string };

export interface QueuedOp {
	/** Unique id, so the server applies each operation only once. */
	opId: string;
	op: Op;
}

export class OpError extends Error {}

// ---- validation -------------------------------------------------------------------------

const isStr = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max;
const isId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);
const isPts = (v: unknown): v is number | null =>
	v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 15);
const isOptPts = (v: unknown) => v === undefined || isPts(v);
const isDate = (v: unknown): v is string | null =>
	v === null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v));
const isLocalTime = (v: unknown): v is string =>
	typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(v);
const isHalfYear = (v: unknown) => v === 1 || v === 2 || v === 3 || v === 4;

const EVENT_KINDS = ['klausur', 'gfs', 'abi', 'sonstiges'];
const REMINDERS = [10080, 2880, 1440, 360, 60];

function check(ok: boolean, message: string) {
	if (!ok) throw new OpError(message);
}

/** Throws OpError with a German message if the operation is malformed. */
export function validateOp(op: unknown): Op {
	check(typeof op === 'object' && op !== null, 'Ungültige Änderung.');
	const o = op as Op;
	switch (o.type) {
		case 'grade.upsert': {
			const g = o.grade;
			check(typeof g === 'object' && g !== null, 'Ungültige Note.');
			check(isId(g.id) && isId(g.subjectId) && isId(g.gradeTypeId), 'Ungültige Note.');
			check(isHalfYear(g.halfYear), 'Ungültiges Halbjahr.');
			check(isPts(g.points) && isPts(g.forecast), 'Punkte müssen zwischen 0 und 15 liegen.');
			check(
				typeof g.weight === 'number' && g.weight >= 0.1 && g.weight <= 10,
				'Ungültiges Gewicht.'
			);
			check(isDate(g.date), 'Ungültiges Datum.');
			check(isStr(g.note), 'Notiz zu lang.');
			break;
		}
		case 'course.set':
			check(isId(o.subjectId) && isHalfYear(o.halfYear), 'Ungültiger Kurs.');
			check(isOptPts(o.points) && isOptPts(o.forecast), 'Punkte müssen zwischen 0 und 15 liegen.');
			break;
		case 'exam.set':
			check(isId(o.subjectId), 'Ungültiges Prüfungsfach.');
			check(
				isOptPts(o.written) &&
					isOptPts(o.oral) &&
					isOptPts(o.writtenForecast) &&
					isOptPts(o.oralForecast),
				'Punkte müssen zwischen 0 und 15 liegen.'
			);
			break;
		case 'event.upsert': {
			const e = o.event;
			check(typeof e === 'object' && e !== null && isId(e.id), 'Ungültiger Termin.');
			check(e.subjectId === null || isId(e.subjectId), 'Ungültiges Fach.');
			check(isStr(e.title) && e.title.trim().length > 0, 'Der Termin braucht einen Titel.');
			check(EVENT_KINDS.includes(e.kind), 'Ungültige Art.');
			check(isLocalTime(e.start) && (e.end === null || isDate(e.end)), 'Ungültiges Datum.');
			check(
				typeof e.allDay === 'boolean' && e.allDay === (e.start.length === 10),
				'Ungültige Uhrzeit.'
			);
			check(isStr(e.note, 1000), 'Notiz zu lang.');
			check(
				Array.isArray(e.reminders) && e.reminders.every((m) => REMINDERS.includes(m)),
				'Ungültige Erinnerung.'
			);
			break;
		}
		case 'task.upsert': {
			const t = o.task;
			check(typeof t === 'object' && t !== null && isId(t.id), 'Ungültige Aufgabe.');
			check(t.subjectId === null || isId(t.subjectId), 'Ungültiges Fach.');
			check(isStr(t.title) && t.title.trim().length > 0, 'Die Aufgabe braucht einen Titel.');
			check(
				isDate(t.due) && typeof t.done === 'boolean' && typeof t.createdAt === 'number',
				'Ungültige Aufgabe.'
			);
			break;
		}
		case 'goal.upsert': {
			const g = o.goal;
			check(typeof g === 'object' && g !== null && isId(g.id), 'Ungültiges Lernziel.');
			check(g.subjectId === null || isId(g.subjectId), 'Ungültiges Fach.');
			check(isStr(g.title) && g.title.trim().length > 0, 'Das Lernziel braucht einen Titel.');
			check(isPts(g.targetPoints) && isDate(g.due), 'Ungültiges Lernziel.');
			check(
				typeof g.achieved === 'boolean' && typeof g.createdAt === 'number',
				'Ungültiges Lernziel.'
			);
			break;
		}
		case 'grade.delete':
		case 'event.delete':
		case 'task.delete':
		case 'goal.delete':
			check(isId(o.id), 'Ungültige Löschung.');
			break;
		default:
			throw new OpError('Unbekannte Änderung.');
	}
	return o;
}

// ---- applying to a snapshot (used by the app, mirrors the server) -----------------------

function upsert<T>(rows: T[], row: T, same: (r: T) => boolean): T[] {
	const i = rows.findIndex(same);
	if (i < 0) return [...rows, row];
	const copy = [...rows];
	copy[i] = row;
	return copy;
}

const pick = <T extends object>(o: T, keys: (keyof T)[]) =>
	Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]])) as Partial<T>;

/**
 * Applies an operation to a snapshot and returns the new snapshot. Operations that refer to
 * things that no longer exist (e.g. a grade for a deleted subject) are ignored, like on the server.
 */
export function applyOp(snapshot: Snapshot, op: Op): Snapshot {
	const d = snapshot.data;
	const hasSubject = (id: string | null) => id === null || d.subjects.some((s) => s.id === id);
	const next = (data: Partial<typeof d>): Snapshot => ({ ...snapshot, data: { ...d, ...data } });

	switch (op.type) {
		case 'grade.upsert': {
			const g = op.grade;
			const courseExists = d.courses.some(
				(c) => c.subjectId === g.subjectId && c.halfYear === g.halfYear
			);
			if (!courseExists || !d.gradeTypes.some((t) => t.id === g.gradeTypeId)) return snapshot;
			return next({ grades: upsert(d.grades, { ...g }, (r) => r.id === g.id) });
		}
		case 'grade.delete':
			return next({ grades: d.grades.filter((g) => g.id !== op.id) });
		case 'course.set': {
			const existing = d.courses.find(
				(c) => c.subjectId === op.subjectId && c.halfYear === op.halfYear
			);
			if (!existing) return snapshot;
			const updated: CourseRow = { ...existing, ...pick(op, ['points', 'forecast']) };
			return next({ courses: upsert(d.courses, updated, (c) => c === existing) });
		}
		case 'exam.set': {
			if (!d.subjects.some((s) => s.id === op.subjectId)) return snapshot;
			const existing = d.exams.find((e) => e.subjectId === op.subjectId);
			const base: ExamRow = existing ?? {
				subjectId: op.subjectId,
				written: null,
				oral: null,
				writtenForecast: null,
				oralForecast: null
			};
			const updated = {
				...base,
				...pick(op, ['written', 'oral', 'writtenForecast', 'oralForecast'])
			};
			return next({ exams: upsert(d.exams, updated, (e) => e.subjectId === op.subjectId) });
		}
		case 'event.upsert': {
			const e = op.event;
			const existing = d.events.find((x) => x.id === e.id);
			const row: EventRow = {
				...e,
				subjectId: hasSubject(e.subjectId) ? e.subjectId : null,
				externalUid: existing?.externalUid ?? null
			};
			return next({ events: upsert(d.events, row, (x) => x.id === e.id) });
		}
		case 'event.delete':
			return next({ events: d.events.filter((e) => e.id !== op.id) });
		case 'task.upsert': {
			const t = { ...op.task, subjectId: hasSubject(op.task.subjectId) ? op.task.subjectId : null };
			return next({ tasks: upsert(d.tasks, t, (x) => x.id === t.id) });
		}
		case 'task.delete':
			return next({ tasks: d.tasks.filter((t) => t.id !== op.id) });
		case 'goal.upsert': {
			const g = { ...op.goal, subjectId: hasSubject(op.goal.subjectId) ? op.goal.subjectId : null };
			return next({ studyGoals: upsert(d.studyGoals, g, (x) => x.id === g.id) });
		}
		case 'goal.delete':
			return next({ studyGoals: d.studyGoals.filter((g) => g.id !== op.id) });
	}
}
