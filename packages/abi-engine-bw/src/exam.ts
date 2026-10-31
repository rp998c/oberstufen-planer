/**
 * Points of one exam subject in Block II (vierfache Wertung).
 *
 * Source: KM BW, Leitfaden Abitur 2028, 1.5.3 and 1.5.5.
 * - Only written or only oral: points × 4.
 * - Written and oral: PF = (2s + m) / 3, then PF × 4 rounded half up to an integer.
 */
export function examBlockIIPoints(exam: { written?: number; oral?: number }): number {
	const { written, oral } = exam;
	for (const p of [written, oral]) {
		if (p !== undefined && (!Number.isInteger(p) || p < 0 || p > 15)) {
			throw new RangeError(`Exam points must be an integer between 0 and 15, got ${p}`);
		}
	}
	if (written !== undefined && oral !== undefined) {
		// round_half_up(4 × (2s + m) / 3) = floor((8 × (2s + m) + 3) / 6)
		return Math.floor((8 * (2 * written + oral) + 3) / 6);
	}
	const only = written ?? oral;
	if (only === undefined) throw new Error('Exam needs a written or an oral result');
	return only * 4;
}
