import {
	DEFAULT_AREA_WEIGHTS,
	type AreaWeights,
	type BllInput,
	type Category,
	type ExamKind,
	type HalfYear,
	type Level
} from '@oberstufen-planer/abi-engine-bw';
import {
	defaultGrading,
	emptyData,
	type CalEvent,
	type Data,
	type EventKind,
	type GradeKind,
	type TestMode
} from './model.ts';

/** Data as stored by versions before the redesign (server tables / old app cache / old backups). */
interface LegacyData {
	subjects: {
		id: string;
		name: string;
		category: Category;
		level: Level;
		exam: ExamKind;
		fromClass8: boolean;
		color: string;
		sortOrder: number;
		areaWeights?: AreaWeights | null;
	}[];
	courses: { subjectId: string; halfYear: number; points: number | null }[];
	gradeTypes: { id: string; name: string; area?: string; groupAs?: number | null }[];
	grades: {
		id: string;
		subjectId: string;
		halfYear: number;
		gradeTypeId: string;
		points: number | null;
		date: string | null;
		note: string;
	}[];
	exams?: { subjectId: string; written: number | null; oral: number | null }[];
	events?: {
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
	}[];
}

interface LegacySettings {
	profile?: { abiYear: number | null };
	bll?: BllInput;
	areaWeights?: AreaWeights;
}

export const BACKUP_FORMAT = 'oberstufen-planer-backup';

/** Backup file content (Einstellungen → Sichern). */
export function backupFile(data: Data) {
	return { format: BACKUP_FORMAT, version: 2, exportedAt: new Date().toISOString(), data };
}

function kindOf(t: LegacyData['gradeTypes'][number] | undefined): GradeKind {
	if (!t) return 'klausur';
	if (t.groupAs) return 'test';
	if (/gfs/i.test(t.name)) return 'gfs';
	if (t.area === 'muendlich') return 'muendlich';
	if (t.area === 'praktisch') return 'praktisch';
	return 'klausur';
}

function fromLegacy(old: LegacyData, settings: LegacySettings): Data {
	const types = new Map(old.gradeTypes.map((t) => [t.id, t]));
	const d = emptyData();
	d.profile = { abiYear: settings.profile?.abiYear ?? null };
	d.bll = settings.bll ?? { mode: 'none' };

	d.subjects = old.subjects.map((s) => {
		const halfYears = old.courses
			.filter((c) => c.subjectId === s.id)
			.map((c) => c.halfYear as HalfYear)
			.sort();
		const grading = defaultGrading(s.category, s.level);
		const hasTests = old.grades.some(
			(g) => g.subjectId === s.id && kindOf(types.get(g.gradeTypeId)) === 'test'
		);
		return {
			id: s.id,
			name: s.name,
			color: s.color,
			category: s.category,
			level: s.level,
			exam: s.exam ?? null,
			fromClass8: s.fromClass8,
			sortOrder: s.sortOrder,
			halfYears: halfYears.length ? halfYears : [1, 2, 3, 4],
			klausuren: grading.klausuren,
			tests: (hasTests ? 'klausur' : 'none') as TestMode,
			weights: s.areaWeights ?? settings.areaWeights ?? { ...DEFAULT_AREA_WEIGHTS }
		};
	});
	d.zeugnis = old.courses
		.filter((c) => c.points !== null)
		.map((c) => ({ subjectId: c.subjectId, halfYear: c.halfYear as HalfYear, points: c.points! }));
	// grades that were only announced (no points yet) are dropped
	d.grades = old.grades
		.filter((g) => g.points !== null)
		.map((g) => ({
			id: g.id,
			subjectId: g.subjectId,
			halfYear: g.halfYear as HalfYear,
			kind: kindOf(types.get(g.gradeTypeId)),
			points: g.points!,
			date: g.date,
			note: g.note ?? ''
		}));
	d.exams = (old.exams ?? []).map((e) => ({
		subjectId: e.subjectId,
		written: e.written,
		oral: e.oral
	}));
	d.events = (old.events ?? []).map((e): CalEvent => ({
		...e,
		kind: (['klausur', 'gfs', 'abi', 'sonstiges'].includes(e.kind)
			? e.kind
			: 'sonstiges') as EventKind,
		externalUid: e.externalUid ?? null
	}));
	return d;
}

/**
 * Accepts current data, a backup file (old or new) or an old app snapshot and returns current
 * data. Throws on anything else.
 */
export function migrateData(input: unknown): Data {
	if (typeof input !== 'object' || input === null) throw new Error('Keine gültige Datei.');
	const o = input as Record<string, unknown>;
	if (o.version === 2 && Array.isArray(o.subjects))
		return { ...emptyData(), ...(o as unknown as Data) };
	if (typeof o.data === 'object' && o.data !== null) {
		const inner = o.data as Record<string, unknown>;
		if (inner.version === 2) return migrateData(inner);
		if (Array.isArray(inner.subjects) && Array.isArray(inner.gradeTypes)) {
			return fromLegacy(inner as unknown as LegacyData, (o.settings ?? {}) as LegacySettings);
		}
	}
	throw new Error('Keine gültige Sicherung des Oberstufen-Planers.');
}
