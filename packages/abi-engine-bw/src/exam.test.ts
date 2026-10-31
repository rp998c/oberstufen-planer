import { describe, expect, it } from 'vitest';
import { examBlockIIPoints } from './exam.ts';

describe('examBlockIIPoints', () => {
	it('counts a written-only or oral-only exam four times', () => {
		expect(examBlockIIPoints({ written: 11 })).toBe(44);
		expect(examBlockIIPoints({ oral: 15 })).toBe(60);
		expect(examBlockIIPoints({ written: 0 })).toBe(0);
	});

	it('weights written twice and oral once when both exist', () => {
		// (2·12 + 9)/3 = 11 → 44
		expect(examBlockIIPoints({ written: 12, oral: 9 })).toBe(44);
		// (2·10 + 11)/3 = 10.333… → 41.33 → 41
		expect(examBlockIIPoints({ written: 10, oral: 11 })).toBe(41);
		// (2·10 + 12)/3 = 10.666… → 42.67 → 43
		expect(examBlockIIPoints({ written: 10, oral: 12 })).toBe(43);
	});

	it('matches the reference formula (round half up) for all combinations', () => {
		for (let s = 0; s <= 15; s++) {
			for (let m = 0; m <= 15; m++) {
				const expected = Math.round(((2 * s + m) / 3) * 4 + 1e-9);
				expect(examBlockIIPoints({ written: s, oral: m }), `s=${s} m=${m}`).toBe(expected);
			}
		}
	});

	it('rejects missing or invalid points', () => {
		expect(() => examBlockIIPoints({})).toThrow();
		expect(() => examBlockIIPoints({ written: 16 })).toThrow(RangeError);
		expect(() => examBlockIIPoints({ written: 7, oral: -1 })).toThrow(RangeError);
	});
});
