import { examBlockIIPoints } from './exam.ts';
import {
	DEFAULT_FORECAST,
	effectiveCoursePoints,
	effectiveExam,
	overallAverage
} from './forecast.ts';
import { gradeFromTotalPoints } from './grade.ts';
import { validateSetup } from './setup.ts';
import {
	HALF_YEARS,
	courseKey,
	isValidPoints,
	type HalfYear,
	type Issue,
	type PlanInput,
	type SubjectInput
} from './types.ts';

/** Leitfaden 1.5.2: exactly 40 courses, two LF doubled → 48 units, scaled to 40. */
export const BLOCK_I_COURSES = 40;
const BLOCK_I_UNITS = 48;
const MAX_UNTERKURSE = 8;
const MAX_UNTERKURSE_LF = 3;
const UNTERKURS_BELOW = 5;

export interface CountedCourse {
	key: string;
	/** 'bll' for the two slots of a besondere Lernleistung. */
	subjectId: string;
	halfYear: HalfYear | null;
	points: number;
	actual: boolean;
	/** Counts twice (doubled Leistungsfach). */
	doubled: boolean;
	/** Has to be counted by the rules (or was locked by the user). */
	mandatory: boolean;
}

export interface BlockIResult {
	points: number;
	/** Sum of the counted points including the doubled courses (max 720). */
	rawSum: number;
	counted: CountedCourse[];
	/** Taken courses that are not counted. */
	notCounted: CountedCourse[];
	doubled: string[];
	unterkurse: number;
	unterkurseLF: number;
	/** Subject ids chosen for the requirements "one foreign language", "one science", … */
	choice: {
		fremdsprache?: string;
		naturwissenschaft?: string;
		zweites?: string;
		kunstMusik?: string;
	};
}

export interface ExamResultLine {
	subjectId: string;
	kind: 'written' | 'oral' | 'bll';
	written?: number;
	oral?: number;
	/** Points in vierfacher Wertung (0–60). */
	points: number;
	actual: boolean;
	isLF: boolean;
}

export interface BlockIIResult {
	points: number;
	exams: ExamResultLine[];
}

export interface CalculationResult {
	blockI: BlockIResult;
	blockII: BlockIIResult;
	total: number;
	/** Durchschnittsnote if all admission conditions are met, else null. */
	grade: number | null;
	/** Durchschnittsnote from the points alone, ignoring the conditions (null below 300). */
	gradeIgnoringConditions: number | null;
	passed: boolean;
	/** true if any counted course or exam is a forecast and not a real grade. */
	projected: boolean;
	issues: Issue[];
}

interface PoolCourse {
	key: string;
	subjectId: string;
	halfYear: HalfYear | null;
	points: number;
	actual: boolean;
	isLF: boolean;
}

function byBest(a: PoolCourse, b: PoolCourse): number {
	return b.points - a.points || Number(b.actual) - Number(a.actual) || a.key.localeCompare(b.key);
}

function takenKeys(subject: SubjectInput): string[] {
	return HALF_YEARS.filter((h) => subject.courses[h]).map((h) => courseKey(subject.id, h));
}

function hasFourCourses(subject: SubjectInput): boolean {
	return takenKeys(subject).length === 4;
}

/** All pairs of the given ids. */
function pairs(ids: string[]): [string, string][] {
	const out: [string, string][] = [];
	for (let i = 0; i < ids.length; i++)
		for (let j = i + 1; j < ids.length; j++) out.push([ids[i]!, ids[j]!]);
	return out;
}

function bllPoints(input: PlanInput, fallback: number | null): { points: number; actual: boolean } {
	const bll = input.bll;
	if (bll && isValidPoints(bll.points)) return { points: bll.points, actual: true };
	if (bll && isValidPoints(bll.forecast)) return { points: bll.forecast, actual: false };
	return { points: Math.round(fallback ?? DEFAULT_FORECAST), actual: false };
}

function calculateBlockI(input: PlanInput, fallback: number | null, issues: Issue[]): BlockIResult {
	const { subjects } = input;
	const bll = input.bll;
	const skipSeminar = bll !== undefined && bll.mode !== 'none' && bll.fromSeminarkurs === true;
	const exclude = new Set(input.overrides?.exclude ?? []);

	// --- pool of all taken courses -------------------------------------------------------
	const pool = new Map<string, PoolCourse>();
	for (const s of subjects) {
		if (skipSeminar && s.category === 'seminarkurs') continue;
		for (const h of HALF_YEARS) {
			const eff = effectiveCoursePoints(s, h, fallback);
			if (!eff) continue;
			const key = courseKey(s.id, h);
			pool.set(key, { key, subjectId: s.id, halfYear: h, ...eff, isLF: s.level === 'LF' });
		}
	}
	if (bll?.mode === 'blockI') {
		const p = bllPoints(input, fallback);
		for (const key of ['bll:1', 'bll:2']) {
			pool.set(key, { key, subjectId: 'bll', halfYear: null, ...p, isLF: false });
		}
	}

	// --- courses that always have to be counted ------------------------------------------
	const lf = subjects.filter((s) => s.level === 'LF');
	const wirtschaftLF = lf.some((s) => s.category === 'wirtschaft');
	const bllReplaces = bll?.mode === 'blockII' ? bll.replacesSubjectId : undefined;
	const base = new Set<string>();
	for (const s of subjects) {
		if (skipSeminar && s.category === 'seminarkurs') continue;
		const keys = takenKeys(s);
		if (
			s.level === 'LF' ||
			s.category === 'deutsch' ||
			s.category === 'mathe' ||
			s.category === 'geschichte' ||
			(s.exam === 'oral' && s.id !== bllReplaces)
		) {
			keys.forEach((k) => base.add(k));
		} else if (s.category === 'geographie' || s.category === 'gemeinschaftskunde') {
			// "die belegpflichtigen Kurse": the first two taught courses, only the first with LF Wirtschaft
			keys.slice(0, wirtschaftLF ? 1 : 2).forEach((k) => base.add(k));
		}
	}
	for (const k of input.overrides?.include ?? []) if (pool.has(k)) base.add(k);

	// --- choices for the remaining requirements ------------------------------------------
	const fs = subjects.filter(
		(s) => s.category === 'fremdsprache' && s.fromClass8 !== false && hasFourCourses(s)
	);
	const nw = subjects.filter((s) => s.category === 'naturwissenschaft' && hasFourCourses(s));
	const nwOrTech = subjects.filter(
		(s) =>
			(s.category === 'naturwissenschaft' || s.category === 'nwt' || s.category === 'informatik') &&
			hasFourCourses(s)
	);
	const art = subjects.filter(
		(s) => (s.category === 'kunst' || s.category === 'musik') && takenKeys(s).length >= 2
	);

	if (!fs.length) {
		issues.push({
			code: 'req-fremdsprache',
			severity: 'error',
			message: 'Es fehlt eine Fremdsprache (ab Klasse 8) mit vier Kursen.'
		});
	}
	if (!nw.length) {
		issues.push({
			code: 'req-naturwissenschaft',
			severity: 'error',
			message: 'Es fehlt eine Naturwissenschaft (Biologie, Chemie oder Physik) mit vier Kursen.'
		});
	}
	if (!art.length) {
		issues.push({
			code: 'req-kunst-musik',
			severity: 'error',
			message: 'Es fehlen zwei Kurse in Bildender Kunst oder Musik.'
		});
	}

	// --- doubled Leistungsfächer -------------------------------------------------------
	const lfSum = (id: string) =>
		[...pool.values()].filter((c) => c.subjectId === id).reduce((a, c) => a + c.points, 0);
	let doubled: string[] = [];
	const override = input.overrides?.doubled;
	if (
		override &&
		override.every((id) => lf.some((s) => s.id === id)) &&
		override[0] !== override[1]
	) {
		doubled = [...override];
	} else {
		const best = pairs(lf.map((s) => s.id)).sort(
			(a, b) => lfSum(b[0]) + lfSum(b[1]) - (lfSum(a[0]) + lfSum(a[1]))
		)[0];
		doubled = best ? [...best] : lf.map((s) => s.id);
	}
	const doubledSet = new Set(doubled);

	// --- try every combination of choices, keep the best ---------------------------------
	type Candidate = {
		counted: PoolCourse[];
		mandatory: Set<string>;
		choice: BlockIResult['choice'];
		points: number;
		rawSum: number;
		unter: number;
		unterLF: number;
		valid: boolean;
		secondMissing: boolean;
	};
	let best: Candidate | null = null;

	const orNull = <T>(xs: T[]) => (xs.length ? xs : [null]);
	for (const f of orNull(fs)) {
		for (const n of orNull(nw)) {
			const seconds = [
				...fs.filter((s) => s.id !== f?.id),
				...nwOrTech.filter((s) => s.id !== n?.id)
			];
			for (const second of orNull(seconds)) {
				for (const a of orNull(art)) {
					const mandatory = new Set(base);
					for (const s of [f, n, second]) if (s) takenKeys(s).forEach((k) => mandatory.add(k));
					if (a) {
						const artBest = takenKeys(a)
							.map((k) => pool.get(k)!)
							.sort(byBest)
							.slice(0, 2);
						artBest.forEach((c) => mandatory.add(c.key));
					}

					const forced = [...mandatory].map((k) => pool.get(k)).filter((c) => c !== undefined);
					const fill = [...pool.values()]
						.filter((c) => !mandatory.has(c.key) && !exclude.has(c.key) && c.points > 0)
						.sort(byBest)
						.slice(0, Math.max(0, BLOCK_I_COURSES - forced.length));
					const counted = [...forced, ...fill];

					const rawSum = counted.reduce(
						(acc, c) => acc + c.points * (doubledSet.has(c.subjectId) ? 2 : 1),
						0
					);
					const unter = counted.filter((c) => c.points < UNTERKURS_BELOW).length;
					const unterLF = counted.filter((c) => c.isLF && c.points < UNTERKURS_BELOW).length;
					const zero = forced.some((c) => c.points === 0);
					const points = Math.round((rawSum * BLOCK_I_COURSES) / BLOCK_I_UNITS);
					const valid =
						counted.length === BLOCK_I_COURSES &&
						unter <= MAX_UNTERKURSE &&
						unterLF <= MAX_UNTERKURSE_LF &&
						!zero;

					const cand: Candidate = {
						counted,
						mandatory,
						choice: {
							fremdsprache: f?.id,
							naturwissenschaft: n?.id,
							zweites: second?.id,
							kunstMusik: a?.id
						},
						points,
						rawSum,
						unter,
						unterLF,
						valid,
						secondMissing: second === null
					};
					if (
						!best ||
						Number(cand.valid) - Number(best.valid) > 0 ||
						(cand.valid === best.valid &&
							(cand.points > best.points ||
								(cand.points === best.points && cand.unter < best.unter)))
					) {
						best = cand;
					}
				}
			}
		}
	}

	const chosen = best!;
	if (chosen.secondMissing && fs.length && nw.length) {
		issues.push({
			code: 'req-zweites',
			severity: 'error',
			message:
				'Es fehlen vier Kurse in einer zweiten Fremdsprache oder einer zweiten Naturwissenschaft (bzw. NwT/Informatik).'
		});
	}
	if (chosen.counted.length < BLOCK_I_COURSES) {
		issues.push({
			code: 'blockI-count',
			severity: 'error',
			message: `Es können nur ${chosen.counted.length} statt ${BLOCK_I_COURSES} Kurse angerechnet werden (Kurse mit 0 Punkten zählen nicht).`
		});
	}
	if (chosen.mandatory.size > BLOCK_I_COURSES) {
		issues.push({
			code: 'blockI-too-many-mandatory',
			severity: 'warning',
			message: `Die Pflichtkurse ergeben mehr als ${BLOCK_I_COURSES} Kurse – bitte die Fächerwahl prüfen.`
		});
	}
	const ignoredExcludes = [...exclude].filter((k) => chosen.mandatory.has(k));
	if (ignoredExcludes.length) {
		issues.push({
			code: 'exclude-mandatory',
			severity: 'warning',
			message: `${ignoredExcludes.length} ausgeschlossene(r) Kurs(e) muss/müssen angerechnet werden und wurde(n) trotzdem eingebracht.`
		});
	}

	const toCounted = (c: PoolCourse, isCounted: boolean): CountedCourse => ({
		key: c.key,
		subjectId: c.subjectId,
		halfYear: c.halfYear,
		points: c.points,
		actual: c.actual,
		doubled: isCounted && doubledSet.has(c.subjectId),
		mandatory: chosen.mandatory.has(c.key)
	});
	const countedKeys = new Set(chosen.counted.map((c) => c.key));
	return {
		points: chosen.points,
		rawSum: chosen.rawSum,
		counted: chosen.counted.map((c) => toCounted(c, true)),
		notCounted: [...pool.values()]
			.filter((c) => !countedKeys.has(c.key))
			.map((c) => toCounted(c, false)),
		doubled,
		unterkurse: chosen.unter,
		unterkurseLF: chosen.unterLF,
		choice: chosen.choice
	};
}

function calculateBlockII(input: PlanInput, fallback: number | null): BlockIIResult {
	const bll = input.bll;
	const exams: ExamResultLine[] = [];
	for (const s of input.subjects) {
		if (s.exam === null) continue;
		const isLF = s.level === 'LF';
		if (bll?.mode === 'blockII' && bll.replacesSubjectId === s.id) {
			const p = bllPoints(input, fallback);
			exams.push({
				subjectId: s.id,
				kind: 'bll',
				oral: p.points,
				points: p.points * 4,
				actual: p.actual,
				isLF
			});
			continue;
		}
		const eff = effectiveExam(s, fallback);
		const written = eff.written?.points;
		const oral = eff.oral?.points;
		const actual = (eff.written?.actual ?? true) && (eff.oral?.actual ?? true);
		exams.push({
			subjectId: s.id,
			kind: s.exam,
			written,
			oral,
			points: examBlockIIPoints({ written, oral }),
			actual,
			isLF
		});
	}
	return { points: exams.reduce((a, e) => a + e.points, 0), exams };
}

/** Admission conditions, Leitfaden 1.9.1. */
function checkAdmission(blockI: BlockIResult, blockII: BlockIIResult, input: PlanInput): Issue[] {
	const issues: Issue[] = [];
	const name = (id: string) => input.subjects.find((s) => s.id === id)?.name ?? id;

	if (blockI.points < 200) {
		issues.push({
			code: 'blockI-min',
			severity: 'error',
			message: `Block I: mindestens 200 Punkte nötig (aktuell ${blockI.points}).`
		});
	}
	if (blockI.unterkurse > MAX_UNTERKURSE) {
		issues.push({
			code: 'unterkurse',
			severity: 'error',
			message: `Zu viele unterpunktete Kurse: ${blockI.unterkurse} von höchstens ${MAX_UNTERKURSE}.`
		});
	}
	if (blockI.unterkurseLF > MAX_UNTERKURSE_LF) {
		issues.push({
			code: 'unterkurse-lf',
			severity: 'error',
			message: `Zu viele unterpunktete Kurse in den Leistungsfächern: ${blockI.unterkurseLF} von höchstens ${MAX_UNTERKURSE_LF}.`
		});
	}

	// "Unter den belegpflichtigen Kursen darf keiner mit 0 Punkten bewertet sein."
	const zeroMandatory = [...blockI.counted, ...blockI.notCounted].filter(
		(c) => c.mandatory && c.points === 0
	);
	for (const c of zeroMandatory) {
		issues.push({
			code: 'zero-points',
			severity: 'error',
			subjectId: c.subjectId,
			message: `${name(c.subjectId)}, Halbjahr ${c.halfYear}: Pflichtkurs mit 0 Punkten.`
		});
	}
	const zeroOther = input.subjects.filter(
		(s) =>
			['religion_ethik', 'sport'].includes(s.category) &&
			HALF_YEARS.some((h) => s.courses[h]?.points === 0)
	);
	for (const s of zeroOther) {
		issues.push({
			code: 'zero-points',
			severity: 'error',
			subjectId: s.id,
			message: `${s.name}: belegpflichtiger Kurs mit 0 Punkten.`
		});
	}

	if (blockII.exams.length) {
		if (blockII.points < 100) {
			issues.push({
				code: 'blockII-min',
				severity: 'error',
				message: `Block II: mindestens 100 Punkte nötig (aktuell ${blockII.points}).`
			});
		}
		const atLeast20 = blockII.exams.filter((e) => e.points >= 20);
		if (atLeast20.length < 3 || atLeast20.filter((e) => e.isLF).length < 2) {
			issues.push({
				code: 'blockII-20',
				severity: 'error',
				message:
					'Block II: In drei Prüfungsfächern, darunter zwei Leistungsfächern, sind jeweils mindestens 20 Punkte (5 Notenpunkte) nötig.'
			});
		}
		for (const e of blockII.exams.filter((e) => e.points < 4)) {
			issues.push({
				code: 'blockII-zero',
				severity: 'error',
				subjectId: e.subjectId,
				message: `${name(e.subjectId)}: In jedem Prüfungsfach sind mindestens 4 Punkte (vierfach) nötig.`
			});
		}
	}
	return issues;
}

/** Calculates the whole Gesamtqualifikation for Baden-Württemberg. */
export function calculate(input: PlanInput): CalculationResult {
	const fallback = overallAverage(input.subjects);
	const issues: Issue[] = validateSetup(input);

	const blockI = calculateBlockI(input, fallback, issues);
	const blockII = calculateBlockII(input, fallback);
	issues.push(...checkAdmission(blockI, blockII, input));

	const total = blockI.points + blockII.points;
	const passed = !issues.some((i) => i.severity === 'error');
	const gradeIgnoringConditions = total >= 300 ? gradeFromTotalPoints(Math.min(total, 900)) : null;
	const projected = blockI.counted.some((c) => !c.actual) || blockII.exams.some((e) => !e.actual);

	return {
		blockI,
		blockII,
		total,
		grade: passed ? gradeIgnoringConditions : null,
		gradeIgnoringConditions,
		passed,
		projected,
		issues
	};
}
