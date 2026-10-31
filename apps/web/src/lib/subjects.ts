import type { Category, HalfYear } from '@oberstufen-planer/abi-engine-bw';

export interface SubjectPreset {
	name: string;
	category: Category;
	/** Typical half-years the subject is taken in. */
	halfYears: HalfYear[];
	/** Part of the Pflichtbereich for everyone (preselected in the setup). */
	compulsory?: boolean;
	fromClass8?: boolean;
	/** Can be a Leistungsfach (Pflichtbereich, Leitfaden 1.2.3). */
	canBeLF?: boolean;
}

const ALL: HalfYear[] = [1, 2, 3, 4];

/** Subjects of the Kursstufe at allgemein bildenden Gymnasien in BW (Leitfaden 1.2.1). */
export const SUBJECT_PRESETS: SubjectPreset[] = [
	{ name: 'Deutsch', category: 'deutsch', halfYears: ALL, compulsory: true, canBeLF: true },
	{ name: 'Mathematik', category: 'mathe', halfYears: ALL, compulsory: true, canBeLF: true },
	{ name: 'Englisch', category: 'fremdsprache', halfYears: ALL, compulsory: true, canBeLF: true },
	{ name: 'Französisch', category: 'fremdsprache', halfYears: ALL, canBeLF: true },
	{ name: 'Latein', category: 'fremdsprache', halfYears: ALL, canBeLF: true },
	{ name: 'Spanisch', category: 'fremdsprache', halfYears: ALL, canBeLF: true },
	{ name: 'Italienisch', category: 'fremdsprache', halfYears: ALL, canBeLF: true },
	{ name: 'Russisch', category: 'fremdsprache', halfYears: ALL, canBeLF: true },
	{ name: 'Griechisch', category: 'fremdsprache', halfYears: ALL, canBeLF: true },
	{ name: 'Chinesisch', category: 'fremdsprache', halfYears: ALL, canBeLF: true },
	{ name: 'Portugiesisch', category: 'fremdsprache', halfYears: ALL, canBeLF: true },
	{
		name: 'Biologie',
		category: 'naturwissenschaft',
		halfYears: ALL,
		compulsory: true,
		canBeLF: true
	},
	{ name: 'Chemie', category: 'naturwissenschaft', halfYears: ALL, canBeLF: true },
	{ name: 'Physik', category: 'naturwissenschaft', halfYears: ALL, canBeLF: true },
	{ name: 'NwT', category: 'nwt', halfYears: ALL, canBeLF: true },
	{ name: 'Informatik', category: 'informatik', halfYears: ALL, canBeLF: true },
	{ name: 'Geschichte', category: 'geschichte', halfYears: ALL, compulsory: true, canBeLF: true },
	{
		name: 'Geographie',
		category: 'geographie',
		halfYears: [1, 2],
		compulsory: true,
		canBeLF: true
	},
	{
		name: 'Gemeinschaftskunde',
		category: 'gemeinschaftskunde',
		halfYears: [3, 4],
		compulsory: true,
		canBeLF: true
	},
	{ name: 'Wirtschaft', category: 'wirtschaft', halfYears: ALL, canBeLF: true },
	{ name: 'Religion (ev.)', category: 'religion_ethik', halfYears: ALL, canBeLF: true },
	{ name: 'Religion (kath.)', category: 'religion_ethik', halfYears: ALL, canBeLF: true },
	{ name: 'Ethik', category: 'religion_ethik', halfYears: ALL, canBeLF: true },
	{ name: 'Bildende Kunst', category: 'kunst', halfYears: ALL, canBeLF: true },
	{ name: 'Musik', category: 'musik', halfYears: ALL, canBeLF: true },
	{ name: 'Sport', category: 'sport', halfYears: ALL, compulsory: true, canBeLF: true },
	{ name: 'Seminarkurs', category: 'seminarkurs', halfYears: [1, 2] },
	{ name: 'Philosophie', category: 'sonstiges', halfYears: ALL },
	{ name: 'Psychologie', category: 'sonstiges', halfYears: ALL },
	{ name: 'Literatur und Theater', category: 'sonstiges', halfYears: ALL },
	{ name: 'Vertiefungskurs Mathematik', category: 'sonstiges', halfYears: ALL },
	{ name: 'Vertiefungskurs Sprache', category: 'sonstiges', halfYears: ALL },
	{ name: 'Astronomie', category: 'sonstiges', halfYears: ALL },
	{ name: 'Darstellende Geometrie', category: 'sonstiges', halfYears: ALL }
];

export const SUBJECT_COLORS = [
	'#2563eb',
	'#dc2626',
	'#16a34a',
	'#9333ea',
	'#ea580c',
	'#0891b2',
	'#ca8a04',
	'#db2777',
	'#4f46e5',
	'#059669',
	'#7c3aed',
	'#b45309',
	'#0d9488',
	'#e11d48',
	'#65a30d',
	'#475569'
];

export const HALF_YEAR_LABELS: Record<HalfYear, string> = {
	1: 'J1 · 1. HJ',
	2: 'J1 · 2. HJ',
	3: 'J2 · 1. HJ',
	4: 'J2 · 2. HJ'
};

export const LEVEL_LABELS = { LF: 'Leistungsfach', BF: 'Basisfach' } as const;
export const EXAM_LABELS = { written: 'schriftlich', oral: 'mündlich' } as const;
