/**
 * Half-year grade from single grades ("Leistungen").
 *
 * Each grade belongs to a grade type (Klausur, GFS, mündlich …). Within a type the grades are
 * averaged (optionally weighted per grade). The type averages are then combined using the
 * type weights; types without grades are left out and the remaining weights renormalised.
 * The school decides the real half-year grade, so this is an estimate that the user can
 * override by entering the report-card grade.
 */
export interface GradeEntry {
	points: number;
	typeId: string;
	/** Weight of this single grade within its type, default 1. */
	weight?: number;
}

export interface GradeTypeWeight {
	id: string;
	/** Relative weight of the type, e.g. 2 for Klausuren and 1 for mündlich. */
	weight: number;
}

export interface HalfYearPoints {
	/** Unrounded weighted average. */
	exact: number;
	/** Rounded half up to whole points, as on a report card. */
	points: number;
}

export function halfYearPoints(
	grades: GradeEntry[],
	types: GradeTypeWeight[]
): HalfYearPoints | null {
	const typeWeight = new Map(types.map((t) => [t.id, t.weight]));
	const perType = new Map<string, { sum: number; weight: number }>();

	for (const g of grades) {
		const w = g.weight ?? 1;
		if (w <= 0) continue;
		const acc = perType.get(g.typeId) ?? { sum: 0, weight: 0 };
		acc.sum += g.points * w;
		acc.weight += w;
		perType.set(g.typeId, acc);
	}

	let sum = 0;
	let weight = 0;
	for (const [typeId, acc] of perType) {
		const tw = typeWeight.get(typeId) ?? 1;
		if (tw <= 0 || acc.weight === 0) continue;
		sum += (acc.sum / acc.weight) * tw;
		weight += tw;
	}
	if (weight === 0) return null;

	const exact = sum / weight;
	return { exact, points: Math.min(15, Math.floor(exact + 0.5 + 1e-9)) };
}
