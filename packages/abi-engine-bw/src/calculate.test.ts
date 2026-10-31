import { describe, expect, it } from 'vitest';
import { calculate } from './calculate.ts';
import { minTotalForGrade, requiredExamPoints } from './target.ts';
import type { Category, ExamKind, HalfYear, Level, PlanInput, SubjectInput } from './types.ts';

function subject(
	id: string,
	category: Category,
	opts: {
		level?: Level;
		exam?: ExamKind;
		points?: number | (number | null)[];
		halfYears?: HalfYear[];
		fromClass8?: boolean;
		written?: number;
		oral?: number;
	} = {}
): SubjectInput {
	const halfYears = opts.halfYears ?? [1, 2, 3, 4];
	const pts = opts.points ?? 10;
	const courses: SubjectInput['courses'] = {};
	halfYears.forEach((h, i) => {
		const p = Array.isArray(pts) ? pts[i] : pts;
		courses[h] = { points: p ?? null };
	});
	const level = opts.level ?? 'BF';
	return {
		id,
		name: id,
		category,
		level,
		exam: opts.exam ?? (level === 'LF' ? 'written' : null),
		fromClass8: opts.fromClass8,
		courses,
		examResult: {
			written: opts.written ?? (level === 'LF' ? 10 : undefined),
			oral: opts.oral ?? (opts.exam === 'oral' ? 10 : undefined)
		}
	};
}

/**
 * A typical student: LF Deutsch, Mathe, Englisch; oral exams Geschichte and Physik;
 * Chemie as second science; exactly 40 courses plus 2 Seminarkurs courses.
 */
function student(points: Partial<Record<string, number | (number | null)[]>> = {}): PlanInput {
	return {
		subjects: [
			subject('deutsch', 'deutsch', { level: 'LF', points: points.deutsch }),
			subject('mathe', 'mathe', { level: 'LF', points: points.mathe }),
			subject('englisch', 'fremdsprache', { level: 'LF', points: points.englisch }),
			subject('geschichte', 'geschichte', { exam: 'oral', points: points.geschichte }),
			subject('physik', 'naturwissenschaft', { exam: 'oral', points: points.physik }),
			subject('chemie', 'naturwissenschaft', { points: points.chemie }),
			subject('geo', 'geographie', { halfYears: [1, 2], points: points.geo }),
			subject('gk', 'gemeinschaftskunde', { halfYears: [3, 4], points: points.gk }),
			subject('religion', 'religion_ethik', { points: points.religion }),
			subject('kunst', 'kunst', { points: points.kunst }),
			subject('sport', 'sport', { points: points.sport }),
			subject('seminar', 'seminarkurs', { halfYears: [1, 2], points: points.seminar })
		]
	};
}

describe('calculate – totals', () => {
	it('10 points everywhere gives 400 + 200 = 600 → 2,3', () => {
		const r = calculate(student());
		expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
		expect(r.blockI.counted).toHaveLength(40);
		expect(r.blockI.rawSum).toBe(480);
		expect(r.blockI.points).toBe(400);
		expect(r.blockII.points).toBe(200);
		expect(r.total).toBe(600);
		expect(r.grade).toBe(2.3);
		expect(r.passed).toBe(true);
		expect(r.projected).toBe(false);
	});

	it('15 points everywhere gives 900 → 1,0', () => {
		const all15 = student(
			Object.fromEntries(
				[
					'deutsch',
					'mathe',
					'englisch',
					'geschichte',
					'physik',
					'chemie',
					'geo',
					'gk',
					'religion',
					'kunst',
					'sport',
					'seminar'
				].map((k) => [k, 15])
			)
		);
		all15.subjects.forEach((s) => {
			s.examResult = {
				written: s.exam === 'written' ? 15 : undefined,
				oral: s.exam === 'oral' ? 15 : undefined
			};
		});
		const r = calculate(all15);
		expect(r.blockI.points).toBe(600);
		expect(r.blockII.points).toBe(300);
		expect(r.grade).toBe(1.0);
	});
});

describe('calculate – Block I selection', () => {
	it('counts all mandatory courses and fills up with the best others', () => {
		const r = calculate(student({ seminar: 14, sport: [5, 6, 7, 8] }));
		const counted = new Set(r.blockI.counted.map((c) => c.key));
		// both Seminarkurs courses (14) beat the two weakest Sport courses (5, 6)
		expect(counted.has('seminar:1')).toBe(true);
		expect(counted.has('seminar:2')).toBe(true);
		expect(counted.has('sport:1')).toBe(false);
		expect(counted.has('sport:2')).toBe(false);
		// all Leistungsfach, Geschichte and oral-exam courses are mandatory
		for (const id of ['deutsch', 'mathe', 'englisch', 'geschichte', 'physik']) {
			for (const h of [1, 2, 3, 4]) expect(counted.has(`${id}:${h}`)).toBe(true);
		}
	});

	it('doubles the two strongest Leistungsfächer', () => {
		const r = calculate(student({ deutsch: 14, mathe: 6, englisch: 12 }));
		expect(r.blockI.doubled.sort()).toEqual(['deutsch', 'englisch']);
	});

	it('respects a manual choice of the doubled Leistungsfächer', () => {
		const input = student({ deutsch: 14, mathe: 6, englisch: 12 });
		input.overrides = { doubled: ['mathe', 'deutsch'] };
		const r = calculate(input);
		expect(r.blockI.doubled).toEqual(['mathe', 'deutsch']);
		expect(r.blockI.rawSum).toBe(
			calculate(student({ deutsch: 14, mathe: 6, englisch: 12 })).blockI.rawSum - 24
		);
	});

	it('only counts the two best Kunst courses as mandatory', () => {
		const r = calculate(student({ kunst: [3, 12, 4, 13] }));
		const kunst = r.blockI.counted.filter((c) => c.subjectId === 'kunst');
		expect(
			kunst
				.filter((c) => c.mandatory)
				.map((c) => c.points)
				.sort()
		).toEqual([12, 13]);
	});

	it('never counts optional courses with 0 points', () => {
		const r = calculate(student({ seminar: 0 }));
		expect(r.blockI.counted.some((c) => c.subjectId === 'seminar')).toBe(false);
		expect(r.blockI.counted).toHaveLength(40);
	});

	it('honours include and exclude overrides for optional courses', () => {
		const input = student({ seminar: 14 });
		input.overrides = { exclude: ['seminar:1'], include: ['sport:1'] };
		const counted = new Set(calculate(input).blockI.counted.map((c) => c.key));
		expect(counted.has('seminar:1')).toBe(false);
		expect(counted.has('sport:1')).toBe(true);
	});

	it('ignores excluding a mandatory course and says so', () => {
		const input = student();
		input.overrides = { exclude: ['deutsch:1'] };
		const r = calculate(input);
		expect(r.blockI.counted.some((c) => c.key === 'deutsch:1')).toBe(true);
		expect(r.issues.some((i) => i.code === 'exclude-mandatory')).toBe(true);
	});

	it('with LF Wirtschaft only the first Geographie and GK course is mandatory', () => {
		const input = student({ geo: [2, 14], gk: [3, 14] });
		input.subjects.push(subject('wirtschaft', 'wirtschaft', { level: 'LF' }));
		input.subjects.find((s) => s.id === 'englisch')!.level = 'BF';
		input.subjects.find((s) => s.id === 'englisch')!.exam = null;
		const r = calculate(input);
		const mandatory = r.blockI.counted.filter((c) => c.mandatory).map((c) => c.key);
		expect(mandatory).toContain('geo:1');
		expect(mandatory).not.toContain('geo:2');
		expect(mandatory).toContain('gk:3');
		expect(mandatory).not.toContain('gk:4');
	});

	it('is locally optimal: no swap of an optional course improves Block I', () => {
		let seed = 42;
		const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
		for (let run = 0; run < 30; run++) {
			const p = () => [1, 2, 3, 4].map(() => 4 + Math.floor(rnd() * 12));
			const input = student({
				religion: p(),
				kunst: p(),
				sport: p(),
				seminar: p().slice(0, 2),
				chemie: p()
			});
			const r = calculate(input);
			const optionalCounted = r.blockI.counted.filter((c) => !c.mandatory);
			for (const out of r.blockI.notCounted) {
				for (const inn of optionalCounted) {
					expect(out.points, `${out.key} vs ${inn.key}`).toBeLessThanOrEqual(inn.points);
				}
			}
		}
	});
});

describe('calculate – admission conditions', () => {
	it('flags more than 8 Unterkurse', () => {
		const r = calculate(student({ geschichte: 3, physik: 3, chemie: [3, 3, 10, 10] }));
		expect(r.blockI.unterkurse).toBe(10);
		expect(r.issues.some((i) => i.code === 'unterkurse')).toBe(true);
		expect(r.grade).toBeNull();
		expect(r.gradeIgnoringConditions).not.toBeNull();
	});

	it('flags more than 3 Unterkurse in the Leistungsfächer', () => {
		const r = calculate(student({ mathe: [4, 4, 4, 4] }));
		expect(r.blockI.unterkurseLF).toBe(4);
		expect(r.issues.some((i) => i.code === 'unterkurse-lf')).toBe(true);
	});

	it('flags a mandatory course with 0 points', () => {
		const r = calculate(student({ deutsch: [0, 10, 10, 10] }));
		expect(r.issues.some((i) => i.code === 'zero-points' && i.subjectId === 'deutsch')).toBe(true);
	});

	it('flags 0 points in Sport or Religion even if not counted', () => {
		const r = calculate(student({ sport: [0, 10, 10, 10] }));
		expect(r.issues.some((i) => i.code === 'zero-points' && i.subjectId === 'sport')).toBe(true);
	});

	it('needs 20 points in three exams, two of them Leistungsfächer', () => {
		const input = student();
		input.subjects.find((s) => s.id === 'deutsch')!.examResult = { written: 4 };
		input.subjects.find((s) => s.id === 'mathe')!.examResult = { written: 4 };
		const r = calculate(input);
		expect(r.issues.some((i) => i.code === 'blockII-20')).toBe(true);
	});

	it('needs at least 4 points (×4) in every exam', () => {
		const input = student();
		input.subjects.find((s) => s.id === 'physik')!.examResult = { oral: 0 };
		const r = calculate(input);
		expect(r.issues.some((i) => i.code === 'blockII-zero' && i.subjectId === 'physik')).toBe(true);
	});

	it('combines written and oral exam results (2s + m)/3 × 4', () => {
		const input = student();
		input.subjects.find((s) => s.id === 'deutsch')!.examResult = { written: 10, oral: 12 };
		const r = calculate(input);
		expect(r.blockII.exams.find((e) => e.subjectId === 'deutsch')!.points).toBe(43);
	});
});

describe('calculate – besondere Lernleistung', () => {
	it('counts double in Block I and uses two slots', () => {
		const input = student({ seminar: 12 });
		input.bll = { mode: 'blockI', points: 15, fromSeminarkurs: true };
		const r = calculate(input);
		const bll = r.blockI.counted.filter((c) => c.subjectId === 'bll');
		expect(bll).toHaveLength(2);
		expect(bll.every((c) => c.points === 15)).toBe(true);
		expect(r.blockI.counted.some((c) => c.subjectId === 'seminar')).toBe(false);
	});

	it('replaces an oral exam in Block II', () => {
		const input = student();
		input.bll = { mode: 'blockII', points: 14, replacesSubjectId: 'physik' };
		const r = calculate(input);
		const line = r.blockII.exams.find((e) => e.subjectId === 'physik')!;
		expect(line.kind).toBe('bll');
		expect(line.points).toBe(56);
	});
});

describe('forecasts', () => {
	it('fills missing grades from the subject average and marks the result as projected', () => {
		const r = calculate(student({ deutsch: [12, 12, null, null] }));
		const d = r.blockI.counted.filter((c) => c.subjectId === 'deutsch');
		expect(d.map((c) => c.points)).toEqual([12, 12, 12, 12]);
		expect(d.filter((c) => !c.actual)).toHaveLength(2);
		expect(r.projected).toBe(true);
	});

	it('uses a user forecast before the average', () => {
		const input = student({ deutsch: [12, 12, null, null] });
		input.subjects.find((s) => s.id === 'deutsch')!.courses[3] = { forecast: 6 };
		const r = calculate(input);
		expect(r.blockI.counted.find((c) => c.key === 'deutsch:3')!.points).toBe(6);
	});

	it('uses the course average for a written exam without result', () => {
		const input = student({ mathe: 13 });
		input.subjects.find((s) => s.id === 'mathe')!.examResult = {};
		const r = calculate(input);
		const line = r.blockII.exams.find((e) => e.subjectId === 'mathe')!;
		expect(line.written).toBe(13);
		expect(line.actual).toBe(false);
	});
});

describe('setup validation', () => {
	it('reports a missing Leistungsfach and missing exam subjects', () => {
		const input = student();
		input.subjects = input.subjects.filter((s) => s.id !== 'englisch');
		const codes = calculate(input).issues.map((i) => i.code);
		expect(codes).toContain('lf-count');
	});

	it('needs Deutsch and Mathe among the exam subjects', () => {
		const input = student();
		const m = input.subjects.find((s) => s.id === 'mathe')!;
		m.level = 'BF';
		m.exam = null;
		input.subjects.find((s) => s.id === 'chemie')!.level = 'LF';
		input.subjects.find((s) => s.id === 'chemie')!.exam = 'written';
		expect(calculate(input).issues.map((i) => i.code)).toContain('exam-mathe');
	});

	it('needs two core subjects among the Leistungsfächer', () => {
		const input = student();
		for (const id of ['mathe', 'englisch']) {
			const s = input.subjects.find((x) => x.id === id)!;
			s.level = 'BF';
			s.exam = null;
		}
		input.subjects.push(subject('wirtschaft', 'wirtschaft', { level: 'LF' }));
		input.subjects.push(subject('musik', 'musik', { level: 'LF' }));
		expect(calculate(input).issues.map((i) => i.code)).toContain('lf-core');
	});
});

describe('target calculator', () => {
	it('finds the minimum total for a grade', () => {
		expect(minTotalForGrade(1.0)).toBe(823);
		expect(minTotalForGrade(2.3)).toBe(589);
		expect(minTotalForGrade(4.0)).toBe(300);
		expect(minTotalForGrade(0.9)).toBeNull();
	});

	it('finds the exam points needed for a target grade', () => {
		const input = student();
		input.subjects.forEach((s) => (s.examResult = {}));
		// Block I = 400; for 2,0 we need 643 → Block II ≥ 243 → 5 exams × 4 × x ≥ 243 → x = 13
		const t = requiredExamPoints(input, 2.0);
		expect(t.openExams).toHaveLength(5);
		expect(t.examPoints).toBe(13);
		expect(t.result.grade).toBeLessThanOrEqual(2.0);
	});

	it('returns null if the target is out of reach', () => {
		const input = student({ deutsch: 5, mathe: 5, englisch: 5 });
		input.subjects.forEach((s) => (s.examResult = {}));
		expect(requiredExamPoints(input, 1.0).examPoints).toBeNull();
	});
});
