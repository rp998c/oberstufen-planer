import type { Category, Issue, PlanInput, SubjectInput } from './types.ts';

/** Aufgabenfelder, Leitfaden 1.2.1. Sport and Seminarkurs have none. */
const FIELD: Partial<Record<Category, 1 | 2 | 3>> = {
	deutsch: 1,
	fremdsprache: 1,
	kunst: 1,
	musik: 1,
	geschichte: 2,
	geographie: 2,
	gemeinschaftskunde: 2,
	wirtschaft: 2,
	religion_ethik: 2,
	mathe: 3,
	naturwissenschaft: 3,
	nwt: 3,
	informatik: 3
};

const has = (subjects: SubjectInput[], ...cats: Category[]) =>
	subjects.some((s) => cats.includes(s.category));

/**
 * Checks the subject choice against the rules for Leistungsfächer and exam subjects
 * (Leitfaden 1.2.3, 1.2.4, 1.4). These are planning hints; the school checks the real choice.
 */
export function validateSetup(input: PlanInput): Issue[] {
	const issues: Issue[] = [];
	const { subjects } = input;
	const lf = subjects.filter((s) => s.level === 'LF');
	const oral = subjects.filter((s) => s.exam === 'oral');
	const bllReplacesOral = input.bll?.mode === 'blockII';

	if (lf.length !== 3) {
		issues.push({
			code: 'lf-count',
			severity: 'error',
			message: `Es müssen genau drei Leistungsfächer gewählt sein (aktuell ${lf.length}).`
		});
	}
	for (const s of lf) {
		if (s.exam !== 'written') {
			issues.push({
				code: 'lf-written',
				severity: 'error',
				subjectId: s.id,
				message: `${s.name}: Leistungsfächer werden schriftlich geprüft.`
			});
		}
	}
	for (const s of subjects) {
		if (s.level === 'BF' && s.exam === 'written') {
			issues.push({
				code: 'bf-written',
				severity: 'error',
				subjectId: s.id,
				message: `${s.name}: Schriftlich geprüft werden nur die Leistungsfächer.`
			});
		}
	}

	const expectedOral = bllReplacesOral ? 1 : 2;
	if (oral.length !== expectedOral) {
		issues.push({
			code: 'oral-count',
			severity: 'error',
			message: bllReplacesOral
				? `Mit besonderer Lernleistung in Block II gibt es ein mündliches Prüfungsfach (aktuell ${oral.length}).`
				: `Es müssen genau zwei mündliche Prüfungsfächer gewählt sein (aktuell ${oral.length}).`
		});
	}

	const coreLf = lf.filter(
		(s) =>
			s.category === 'deutsch' ||
			s.category === 'mathe' ||
			s.category === 'naturwissenschaft' ||
			(s.category === 'fremdsprache' && s.fromClass8 !== false)
	);
	if (lf.length === 3 && coreLf.length < 2) {
		issues.push({
			code: 'lf-core',
			severity: 'error',
			message:
				'Zwei der drei Leistungsfächer müssen aus Deutsch, Mathematik, einer Fremdsprache (ab Klasse 8) oder einer Naturwissenschaft sein.'
		});
	}

	const examSubjects = subjects.filter((s) => s.exam !== null);
	if (examSubjects.length > 0) {
		for (const [cat, name] of [
			['deutsch', 'Deutsch'],
			['mathe', 'Mathematik']
		] as const) {
			if (!examSubjects.some((s) => s.category === cat)) {
				issues.push({
					code: `exam-${cat}`,
					severity: 'error',
					message: `${name} muss schriftliches oder mündliches Prüfungsfach sein.`
				});
			}
		}
		const fields = new Set(examSubjects.map((s) => FIELD[s.category]).filter(Boolean));
		if (fields.size < 3) {
			issues.push({
				code: 'exam-fields',
				severity: 'error',
				message:
					'Die Prüfungsfächer müssen alle drei Aufgabenfelder abdecken (sprachlich-künstlerisch, gesellschaftswissenschaftlich, mathematisch-naturwissenschaftlich).'
			});
		}
	}

	const required: [Category[], string][] = [
		[['deutsch'], 'Deutsch'],
		[['mathe'], 'Mathematik'],
		[['fremdsprache'], 'eine Fremdsprache'],
		[['naturwissenschaft'], 'eine Naturwissenschaft'],
		[['geschichte'], 'Geschichte'],
		[['geographie'], 'Geographie'],
		[['gemeinschaftskunde'], 'Gemeinschaftskunde'],
		[['religion_ethik'], 'Religionslehre oder Ethik'],
		[['kunst', 'musik'], 'Bildende Kunst oder Musik'],
		[['sport'], 'Sport']
	];
	for (const [cats, name] of required) {
		if (!has(subjects, ...cats)) {
			issues.push({
				code: `missing-${cats[0]}`,
				severity: 'warning',
				message: `Pflichtfach fehlt: ${name}.`
			});
		}
	}

	if (input.bll?.mode === 'blockII') {
		const target = subjects.find((s) => s.id === input.bll?.replacesSubjectId);
		if (!target || target.level !== 'BF') {
			issues.push({
				code: 'bll-target',
				severity: 'error',
				message:
					'Für die besondere Lernleistung in Block II muss das Basisfach gewählt sein, dessen mündliche Prüfung sie ersetzt.'
			});
		}
	}

	return issues;
}
