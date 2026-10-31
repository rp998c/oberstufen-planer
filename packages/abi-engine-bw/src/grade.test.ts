import { describe, expect, it } from 'vitest';
import { formatGrade, gradeFromTotalPoints } from './grade.ts';

// Official table, Leitfaden Abitur 2028, 1.5.4: [lowest total for the grade, grade]
const TABLE: [number, number][] = [
	[823, 1.0],
	[805, 1.1],
	[787, 1.2],
	[769, 1.3],
	[751, 1.4],
	[733, 1.5],
	[715, 1.6],
	[697, 1.7],
	[679, 1.8],
	[661, 1.9],
	[643, 2.0],
	[625, 2.1],
	[607, 2.2],
	[589, 2.3],
	[571, 2.4],
	[553, 2.5],
	[535, 2.6],
	[517, 2.7],
	[499, 2.8],
	[481, 2.9],
	[463, 3.0],
	[445, 3.1],
	[427, 3.2],
	[409, 3.3],
	[391, 3.4],
	[373, 3.5],
	[355, 3.6],
	[337, 3.7],
	[319, 3.8],
	[301, 3.9],
	[300, 4.0]
];

function tableLookup(total: number): number {
	for (const [min, grade] of TABLE) if (total >= min) return grade;
	throw new Error('unreachable');
}

describe('gradeFromTotalPoints', () => {
	it('matches the official table for every total from 300 to 900', () => {
		for (let e = 300; e <= 900; e++) {
			expect(gradeFromTotalPoints(e), `E = ${e}`).toBe(tableLookup(e));
		}
	});

	it('handles the band edges', () => {
		expect(gradeFromTotalPoints(900)).toBe(1.0);
		expect(gradeFromTotalPoints(823)).toBe(1.0);
		expect(gradeFromTotalPoints(822)).toBe(1.1);
		expect(gradeFromTotalPoints(301)).toBe(3.9);
		expect(gradeFromTotalPoints(300)).toBe(4.0);
	});

	it('returns null below 300 points (not passed)', () => {
		expect(gradeFromTotalPoints(299)).toBeNull();
		expect(gradeFromTotalPoints(0)).toBeNull();
	});

	it('rejects invalid input', () => {
		expect(() => gradeFromTotalPoints(901)).toThrow(RangeError);
		expect(() => gradeFromTotalPoints(-1)).toThrow(RangeError);
		expect(() => gradeFromTotalPoints(650.5)).toThrow(RangeError);
	});
});

describe('formatGrade', () => {
	it('uses a decimal comma', () => {
		expect(formatGrade(1)).toBe('1,0');
		expect(formatGrade(2.3)).toBe('2,3');
	});
});
