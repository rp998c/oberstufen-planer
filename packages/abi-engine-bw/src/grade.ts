/**
 * Gesamtqualifikation → Durchschnittsnote.
 *
 * Source: KM BW, Leitfaden für die gymnasiale Oberstufe, Abitur 2028, 1.5.4 (Tabelle).
 * The table (900–823 → 1,0; 822–805 → 1,1; … 318–301 → 3,9; 300 → 4,0) is equivalent to
 * the KMK formula N = 17/3 − E/180, truncated to one decimal place and capped at 1,0.
 */
export const MIN_TOTAL_POINTS = 300;
export const MAX_TOTAL_POINTS = 900;

/**
 * Returns the Durchschnittsnote for a total of 300–900 points, or `null` if the total is
 * below 300 (Abitur not passed). Throws on non-integer or out-of-range input.
 */
export function gradeFromTotalPoints(total: number): number | null {
	if (!Number.isInteger(total) || total < 0 || total > MAX_TOTAL_POINTS) {
		throw new RangeError(`Total points must be an integer between 0 and 900, got ${total}`);
	}
	if (total < MIN_TOTAL_POINTS) return null;
	// N × 10 = (1020 − E) / 18, truncated; integer arithmetic avoids floating-point errors.
	const tenths = Math.max(10, Math.floor((1020 - total) / 18));
	return tenths / 10;
}

/** Formats a grade the German way, e.g. 1.3 → "1,3". */
export function formatGrade(grade: number): string {
	return grade.toFixed(1).replace('.', ',');
}
