import { CATEGORY_LABELS, type BllInput } from '@oberstufen-planer/abi-engine-bw';
import {
	GRADE_KINDS,
	type CalEvent,
	type Data,
	type ExamResult,
	type Grade,
	type Snapshot,
	type Subject
} from './model.ts';
import { migrateData } from './legacy.ts';

/**
 * Every change is an operation. It is applied to the local document at once and, if a server
 * is connected, sent there later; the server applies the same function (last write wins).
 */
export type Op =
	| { type: 'subject.upsert'; subject: Subject }
	| { type: 'subject.delete'; id: string }
	| { type: 'zeugnis.set'; subjectId: string; halfYear: number; points: number | null }
	| { type: 'grade.upsert'; grade: Grade }
	| { type: 'grade.delete'; id: string }
	| { type: 'exam.set'; subjectId: string; written?: number | null; oral?: number | null }
	| { type: 'event.upsert'; event: CalEvent }
	| { type: 'event.delete'; id: string }
	| { type: 'events.import'; events: CalEvent[] }
	| { type: 'profile.set'; abiYear: number | null }
	| { type: 'goal.set'; goal: number | null }
	| { type: 'bll.set'; bll: BllInput }
	| { type: 'subjects.merge'; subjects: SubjectTemplate[] }
	| { type: 'data.replace'; data: Data };

/** A subject's settings without id, as shared with classmates (Fächer → Exportieren). */
export type SubjectTemplate = Omit<Subject, 'id' | 'sortOrder'>;

export interface QueuedOp {
	/** Unique id, so the server applies each operation only once. */
	opId: string;
	op: Op;
}

export class OpError extends Error {}

// ---- validation -------------------------------------------------------------------------

const isStr = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max;
const isId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);
const isPts = (v: unknown): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 15;
const isNullPts = (v: unknown) => v === null || isPts(v);
const isOptPts = (v: unknown) => v === undefined || isNullPts(v);
const isDate = (v: unknown): v is string | null =>
	v === null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v));
const isLocalTime = (v: unknown): v is string =>
	typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(v);
const isHalfYear = (v: unknown) => v === 1 || v === 2 || v === 3 || v === 4;
const isWeight = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;

export const EVENT_KIND_IDS = ['klausur', 'test', 'gfs', 'abi', 'sonstiges'];
export const REMINDER_MINUTES = [10080, 2880, 1440, 360, 60];

function check(ok: boolean, message: string): asserts ok {
	if (!ok) throw new OpError(message);
}

function checkSubjectSettings(s: SubjectTemplate) {
	check(typeof s === 'object' && s !== null, 'Ungültiges Fach.');
	check(isStr(s.name, 60) && s.name.trim().length > 0, 'Das Fach braucht einen Namen.');
	check(typeof s.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.color), 'Ungültige Farbe.');
	check(s.category in CATEGORY_LABELS, 'Ungültige Fachart.');
	check(s.level === 'LF' || s.level === 'BF', 'Ungültiges Niveau.');
	check(s.exam === null || s.exam === 'written' || s.exam === 'oral', 'Ungültige Prüfung.');
	check(typeof s.fromClass8 === 'boolean', 'Ungültiges Fach.');
	check(
		Array.isArray(s.halfYears) &&
			s.halfYears.length > 0 &&
			s.halfYears.every(isHalfYear) &&
			new Set(s.halfYears).size === s.halfYears.length,
		'Das Fach braucht mindestens ein Halbjahr.'
	);
	check(
		Number.isInteger(s.klausuren) && s.klausuren >= 0 && s.klausuren <= 4,
		'Klausuren pro Halbjahr: 0 bis 4.'
	);
	check(['none', 'klausur', 'muendlich'].includes(s.tests), 'Ungültige Einstellung für Tests.');
	const w = s.weights;
	check(
		typeof w === 'object' &&
			w !== null &&
			isWeight(w.schriftlich) &&
			isWeight(w.muendlich) &&
			isWeight(w.praktisch),
		'Gewichte als Prozent (z. B. 60) oder Bruch (z. B. 2/3) angeben.'
	);
	check(
		w.schriftlich + w.muendlich + w.praktisch > 0,
		'Mindestens ein Bereich braucht ein Gewicht.'
	);
}

function checkEvent(e: CalEvent) {
	check(typeof e === 'object' && e !== null && isId(e.id), 'Ungültiger Termin.');
	check(e.subjectId === null || isId(e.subjectId), 'Ungültiges Fach.');
	check(isStr(e.title) && e.title.trim().length > 0, 'Der Termin braucht einen Titel.');
	check(EVENT_KIND_IDS.includes(e.kind), 'Ungültige Art.');
	check(isLocalTime(e.start) && (e.end === null || isDate(e.end)), 'Ungültiges Datum.');
	check(
		typeof e.allDay === 'boolean' && e.allDay === (e.start.length === 10),
		'Ungültige Uhrzeit.'
	);
	check(isStr(e.note, 1000), 'Notiz zu lang.');
	check(
		Array.isArray(e.reminders) && e.reminders.every((m) => REMINDER_MINUTES.includes(m)),
		'Ungültige Erinnerung.'
	);
	check(e.externalUid === null || isStr(e.externalUid, 300), 'Ungültiger Termin.');
}

function checkData(d: Data) {
	check(typeof d === 'object' && d !== null && d.version === 2, 'Ungültige Datei.');
	for (const k of ['subjects', 'zeugnis', 'grades', 'exams', 'events'] as const) {
		check(Array.isArray(d[k]), 'Ungültige Datei.');
	}
	for (const s of d.subjects) {
		check(isId(s.id) && Number.isFinite(s.sortOrder), 'Ungültiges Fach in der Datei.');
		checkSubjectSettings(s);
	}
	for (const g of d.grades) checkGrade(g);
	for (const z of d.zeugnis)
		check(
			isId(z.subjectId) && isHalfYear(z.halfYear) && isPts(z.points),
			'Ungültige Note in der Datei.'
		);
	for (const e of d.exams)
		check(
			isId(e.subjectId) && isNullPts(e.written) && isNullPts(e.oral),
			'Ungültige Prüfung in der Datei.'
		);
	for (const e of d.events) checkEvent(e);
	check(
		d.goal === null || (Number.isInteger(d.goal) && d.goal >= 10 && d.goal <= 40),
		'Ungültiges Ziel.'
	);
}

function checkGrade(g: Grade) {
	check(typeof g === 'object' && g !== null, 'Ungültige Note.');
	check(isId(g.id) && isId(g.subjectId), 'Ungültige Note.');
	check(isHalfYear(g.halfYear), 'Ungültiges Halbjahr.');
	check(GRADE_KINDS.includes(g.kind), 'Ungültige Notenart.');
	check(isPts(g.points), 'Punkte müssen zwischen 0 und 15 liegen.');
	check(isDate(g.date), 'Ungültiges Datum.');
	check(isStr(g.note), 'Notiz zu lang.');
}

/** Throws OpError with a German message if the operation is malformed. */
export function validateOp(op: unknown): Op {
	check(typeof op === 'object' && op !== null, 'Ungültige Änderung.');
	const o = op as Op;
	switch (o.type) {
		case 'subject.upsert':
			check(isId(o.subject?.id) && Number.isFinite(o.subject.sortOrder), 'Ungültiges Fach.');
			checkSubjectSettings(o.subject);
			break;
		case 'subject.delete':
		case 'grade.delete':
		case 'event.delete':
			check(isId(o.id), 'Ungültige Löschung.');
			break;
		case 'zeugnis.set':
			check(isId(o.subjectId) && isHalfYear(o.halfYear), 'Ungültiger Kurs.');
			check(isNullPts(o.points), 'Punkte müssen zwischen 0 und 15 liegen.');
			break;
		case 'grade.upsert':
			checkGrade(o.grade);
			break;
		case 'exam.set':
			check(isId(o.subjectId), 'Ungültiges Prüfungsfach.');
			check(isOptPts(o.written) && isOptPts(o.oral), 'Punkte müssen zwischen 0 und 15 liegen.');
			break;
		case 'event.upsert':
			checkEvent(o.event);
			break;
		case 'events.import':
			check(Array.isArray(o.events) && o.events.length <= 2000, 'Zu viele Termine.');
			o.events.forEach(checkEvent);
			break;
		case 'profile.set':
			check(
				o.abiYear === null ||
					(Number.isInteger(o.abiYear) && o.abiYear >= 2020 && o.abiYear <= 2100),
				'Ungültiges Abiturjahr.'
			);
			break;
		case 'goal.set':
			check(
				o.goal === null || (Number.isInteger(o.goal) && o.goal >= 10 && o.goal <= 40),
				'Ziel zwischen 1,0 und 4,0.'
			);
			break;
		case 'bll.set': {
			const b = o.bll;
			check(typeof b === 'object' && b !== null, 'Ungültige Lernleistung.');
			check(['none', 'blockI', 'blockII'].includes(b.mode), 'Ungültige Lernleistung.');
			check(isOptPts(b.points), 'Punkte müssen zwischen 0 und 15 liegen.');
			check(b.replacesSubjectId === undefined || isId(b.replacesSubjectId), 'Ungültiges Fach.');
			break;
		}
		case 'subjects.merge':
			check(Array.isArray(o.subjects) && o.subjects.length <= 40, 'Ungültige Datei.');
			o.subjects.forEach(checkSubjectSettings);
			break;
		case 'data.replace':
			checkData(o.data);
			break;
		default:
			throw new OpError('Unbekannte Änderung.');
	}
	return o;
}

// ---- applying ---------------------------------------------------------------------------

function upsert<T>(rows: T[], row: T, same: (r: T) => boolean): T[] {
	const i = rows.findIndex(same);
	if (i < 0) return [...rows, row];
	const copy = [...rows];
	copy[i] = row;
	return copy;
}

const uid = () =>
	typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
		? crypto.randomUUID()
		: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** Applies an operation and returns the new data. Operations on things that no longer exist are ignored. */
export function applyToData(d: Data, op: Op): Data {
	const hasSubject = (id: string | null) => id === null || d.subjects.some((s) => s.id === id);
	switch (op.type) {
		case 'subject.upsert':
			return {
				...d,
				subjects: upsert(d.subjects, { ...op.subject }, (s) => s.id === op.subject.id)
			};
		case 'subject.delete':
			return {
				...d,
				subjects: d.subjects.filter((s) => s.id !== op.id),
				zeugnis: d.zeugnis.filter((z) => z.subjectId !== op.id),
				grades: d.grades.filter((g) => g.subjectId !== op.id),
				exams: d.exams.filter((e) => e.subjectId !== op.id),
				events: d.events.map((e) => (e.subjectId === op.id ? { ...e, subjectId: null } : e))
			};
		case 'zeugnis.set': {
			if (!hasSubject(op.subjectId)) return d;
			const rest = d.zeugnis.filter(
				(z) => !(z.subjectId === op.subjectId && z.halfYear === op.halfYear)
			);
			return {
				...d,
				zeugnis:
					op.points === null
						? rest
						: [...rest, { subjectId: op.subjectId, halfYear: op.halfYear as 1, points: op.points }]
			};
		}
		case 'grade.upsert':
			if (!hasSubject(op.grade.subjectId)) return d;
			return { ...d, grades: upsert(d.grades, { ...op.grade }, (g) => g.id === op.grade.id) };
		case 'grade.delete':
			return { ...d, grades: d.grades.filter((g) => g.id !== op.id) };
		case 'exam.set': {
			if (!hasSubject(op.subjectId)) return d;
			const base: ExamResult = d.exams.find((e) => e.subjectId === op.subjectId) ?? {
				subjectId: op.subjectId,
				written: null,
				oral: null
			};
			const row: ExamResult = {
				...base,
				...(op.written !== undefined ? { written: op.written } : {}),
				...(op.oral !== undefined ? { oral: op.oral } : {})
			};
			return { ...d, exams: upsert(d.exams, row, (e) => e.subjectId === op.subjectId) };
		}
		case 'event.upsert': {
			const e = {
				...op.event,
				subjectId: hasSubject(op.event.subjectId) ? op.event.subjectId : null
			};
			return { ...d, events: upsert(d.events, e, (x) => x.id === e.id) };
		}
		case 'event.delete':
			return { ...d, events: d.events.filter((e) => e.id !== op.id) };
		case 'events.import': {
			let events = d.events;
			for (const e of op.events) {
				const existing = e.externalUid
					? events.find((x) => x.externalUid === e.externalUid)
					: undefined;
				const row = {
					...e,
					id: existing?.id ?? e.id,
					subjectId: existing?.subjectId ?? (hasSubject(e.subjectId) ? e.subjectId : null),
					kind: existing?.kind ?? e.kind,
					reminders: existing?.reminders ?? e.reminders
				};
				events = upsert(events, row, (x) => x.id === row.id);
			}
			return { ...d, events };
		}
		case 'profile.set':
			return { ...d, profile: { ...d.profile, abiYear: op.abiYear } };
		case 'goal.set':
			return { ...d, goal: op.goal };
		case 'bll.set':
			return { ...d, bll: { ...op.bll } };
		case 'subjects.merge': {
			const key = (n: string) => n.trim().toLowerCase();
			if (d.subjects.length === 0) {
				return {
					...d,
					subjects: op.subjects.map((s, i) => ({ ...s, id: uid(), sortOrder: i }))
				};
			}
			return {
				...d,
				subjects: d.subjects.map((s) => {
					const t = op.subjects.find((x) => key(x.name) === key(s.name));
					return t
						? { ...s, klausuren: t.klausuren, tests: t.tests, weights: { ...t.weights } }
						: s;
				})
			};
		}
		case 'data.replace':
			return migrateData(op.data);
	}
}

export function applyOp(snapshot: Snapshot, op: Op): Snapshot {
	return { ...snapshot, data: applyToData(snapshot.data, op) };
}

/** Settings of all subjects without ids and grades, for sharing. */
export function exportSubjects(d: Data): {
	app: 'oberstufen-planer';
	kind: 'faecher';
	subjects: SubjectTemplate[];
} {
	return {
		app: 'oberstufen-planer',
		kind: 'faecher',
		subjects: [...d.subjects]
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map(({ id: _id, sortOrder: _s, ...rest }) => rest)
	};
}
