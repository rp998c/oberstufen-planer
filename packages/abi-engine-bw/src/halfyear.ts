/**
 * Half-year grade from single grades ("Leistungen").
 *
 * How teachers usually weight (and what this models):
 * - Every grade belongs to an area: schriftlich (Klausuren, Tests, …), mündlich, praktisch
 *   (e.g. Sport, Bildende Kunst).
 * - Each subject weights the areas, e.g. schriftlich 75 % : mündlich 25 %, or 1/3 : 2/3,
 *   or 50 / 20 / 30 with a practical part.
 * - Within an area every grade counts the same (optionally with a per-grade weight).
 * - "Test" types are grouped: the average of all tests counts like one Klausur (or N of them).
 *
 * Areas without grades are left out and the remaining weights renormalised. The school
 * decides the real half-year grade; this is an estimate until the report-card grade is entered.
 */
export type Area = 'schriftlich' | 'muendlich' | 'praktisch';
export const AREAS: readonly Area[] = ['schriftlich', 'muendlich', 'praktisch'];
export const AREA_LABELS: Record<Area, string> = {
	schriftlich: 'Schriftlich',
	muendlich: 'Mündlich',
	praktisch: 'Praktisch'
};

/** Relative weights of the areas, e.g. percentages. Only the ratio matters. */
export type AreaWeights = Record<Area, number>;

/** Klausuren 2/3, mündlich 1/3, no practical part. */
export const DEFAULT_AREA_WEIGHTS: AreaWeights = {
	schriftlich: 200 / 3,
	muendlich: 100 / 3,
	praktisch: 0
};

export interface GradeTypeInfo {
	id: string;
	area: Area;
	/**
	 * null: each grade counts on its own. A number: all grades of this type in the half-year
	 * are averaged first and the average counts like this many single grades (tests).
	 */
	groupAs?: number | null;
}

export interface GradeEntry {
	points: number;
	typeId: string;
	/** Weight of this single grade within its area, default 1. */
	weight?: number;
}

export interface AreaResult {
	area: Area;
	/** Average of the area. */
	average: number;
	/** Number of grades in the area. */
	count: number;
	/** Share in the half-year grade, 0–1 (after leaving out areas without grades). */
	share: number;
	/** The area has grades but weight 0 in this subject, so they don't count. */
	ignored: boolean;
}

export interface HalfYearPoints {
	/** Unrounded weighted average. */
	exact: number;
	/** Rounded half up to whole points, as on a report card. */
	points: number;
	areas: AreaResult[];
}

export function halfYearPoints(
	grades: GradeEntry[],
	types: GradeTypeInfo[],
	weights: AreaWeights = DEFAULT_AREA_WEIGHTS
): HalfYearPoints | null {
	const typeById = new Map(types.map((t) => [t.id, t]));

	// items per area: single grades, or one item per test group
	const items: Record<Area, { points: number; weight: number }[]> = {
		schriftlich: [],
		muendlich: [],
		praktisch: []
	};
	const counts: Record<Area, number> = { schriftlich: 0, muendlich: 0, praktisch: 0 };
	const groups = new Map<string, { sum: number; weight: number; type: GradeTypeInfo }>();

	for (const g of grades) {
		const w = g.weight ?? 1;
		if (w <= 0) continue;
		const type = typeById.get(g.typeId) ?? { id: g.typeId, area: 'schriftlich' as Area };
		const area = AREAS.includes(type.area) ? type.area : 'schriftlich';
		counts[area]++;
		if (type.groupAs && type.groupAs > 0) {
			const acc = groups.get(type.id) ?? { sum: 0, weight: 0, type: { ...type, area } };
			acc.sum += g.points * w;
			acc.weight += w;
			groups.set(type.id, acc);
		} else {
			items[area].push({ points: g.points, weight: w });
		}
	}
	for (const { sum, weight, type } of groups.values()) {
		items[type.area].push({ points: sum / weight, weight: type.groupAs! });
	}

	const present = AREAS.filter((a) => items[a].length > 0);
	if (!present.length) return null;

	const averages = new Map(
		present.map((a) => {
			const list = items[a];
			const total = list.reduce((s, x) => s + x.weight, 0);
			return [a, list.reduce((s, x) => s + x.points * x.weight, 0) / total] as const;
		})
	);

	let counted = present.filter((a) => (weights[a] ?? 0) > 0);
	// grades exist only in areas weighted 0: count them equally rather than showing nothing
	const fallback = counted.length === 0;
	if (fallback) counted = present;
	const weightOf = (a: Area) => (fallback ? 1 : weights[a]);
	const total = counted.reduce((s, a) => s + weightOf(a), 0);
	const exact = counted.reduce((s, a) => s + averages.get(a)! * weightOf(a), 0) / total;

	return {
		exact,
		points: Math.min(15, Math.floor(exact + 0.5 + 1e-9)),
		areas: present.map((a) => ({
			area: a,
			average: averages.get(a)!,
			count: counts[a],
			share: counted.includes(a) ? weightOf(a) / total : 0,
			ignored: !counted.includes(a)
		}))
	};
}

/** Parses "75", "33,3", "1/3" or "2/3" (as a share of 100) into a percentage. */
export function parsePercent(input: string): number | null {
	const s = input.trim().replace(',', '.').replace(/\s*%$/, '');
	if (s === '') return null;
	const frac = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(s);
	const value = frac ? (Number(frac[1]) / Number(frac[2])) * 100 : Number(s);
	if (!Number.isFinite(value) || value < 0 || value > 100) return null;
	return value;
}

/** Shows weights as rounded percentages of their sum, e.g. "67 / 33". */
export function formatAreaWeights(w: AreaWeights): string {
	const total = AREAS.reduce((s, a) => s + (w[a] ?? 0), 0) || 1;
	return AREAS.filter((a) => (w[a] ?? 0) > 0)
		.map((a) => `${AREA_LABELS[a]} ${Math.round(((w[a] ?? 0) / total) * 100)} %`)
		.join(' · ');
}
