import { describe, expect, it } from 'vitest';
import { formatAreaWeights, halfYearPoints, parsePercent, type GradeTypeInfo } from './halfyear.ts';

const types: GradeTypeInfo[] = [
	{ id: 'klausur', area: 'schriftlich' },
	{ id: 'test', area: 'schriftlich', groupAs: 1 },
	{ id: 'muendlich', area: 'muendlich' },
	{ id: 'praxis', area: 'praktisch' }
];

describe('halfYearPoints', () => {
	it('weights the areas per subject, e.g. 75 : 25', () => {
		// schriftlich (9 + 11) / 2 = 10, mündlich 14 → 0.75·10 + 0.25·14 = 11
		const r = halfYearPoints(
			[
				{ points: 9, typeId: 'klausur' },
				{ points: 11, typeId: 'klausur' },
				{ points: 14, typeId: 'muendlich' }
			],
			types,
			{ schriftlich: 75, muendlich: 25, praktisch: 0 }
		)!;
		expect(r.exact).toBeCloseTo(11);
		expect(r.points).toBe(11);
		expect(r.areas.map((a) => [a.area, a.average, a.share])).toEqual([
			['schriftlich', 10, 0.75],
			['muendlich', 14, 0.25]
		]);
	});

	it('supports thirds (1/3 : 2/3)', () => {
		const r = halfYearPoints(
			[
				{ points: 6, typeId: 'klausur' },
				{ points: 12, typeId: 'muendlich' }
			],
			types,
			{ schriftlich: 100 / 3, muendlich: 200 / 3, praktisch: 0 }
		)!;
		expect(r.exact).toBeCloseTo(10);
	});

	it('includes a practical part (Sport, BK)', () => {
		// 0.5·10 + 0.2·5 + 0.3·15 = 10.5 → 11
		const r = halfYearPoints(
			[
				{ points: 10, typeId: 'klausur' },
				{ points: 5, typeId: 'muendlich' },
				{ points: 15, typeId: 'praxis' }
			],
			types,
			{ schriftlich: 50, muendlich: 20, praktisch: 30 }
		)!;
		expect(r.exact).toBeCloseTo(10.5);
		expect(r.points).toBe(11);
	});

	it('counts all tests together like one Klausur', () => {
		// Klausuren 8 and 12, tests 15, 15, 9 → test average 13 counts once:
		// schriftlich = (8 + 12 + 13) / 3 = 11
		const r = halfYearPoints(
			[
				{ points: 8, typeId: 'klausur' },
				{ points: 12, typeId: 'klausur' },
				{ points: 15, typeId: 'test' },
				{ points: 15, typeId: 'test' },
				{ points: 9, typeId: 'test' }
			],
			types,
			{ schriftlich: 100, muendlich: 0, praktisch: 0 }
		)!;
		expect(r.exact).toBeCloseTo(11);
		expect(r.areas[0]!.count).toBe(5);
	});

	it('lets tests count like several Klausuren', () => {
		const r = halfYearPoints(
			[
				{ points: 6, typeId: 'klausur' },
				{ points: 12, typeId: 'test2' }
			],
			[...types, { id: 'test2', area: 'schriftlich', groupAs: 2 }],
			{ schriftlich: 1, muendlich: 0, praktisch: 0 }
		)!;
		expect(r.exact).toBeCloseTo((6 + 2 * 12) / 3);
	});

	it('leaves out areas without grades', () => {
		const r = halfYearPoints([{ points: 7, typeId: 'muendlich' }], types, {
			schriftlich: 75,
			muendlich: 25,
			praktisch: 0
		})!;
		expect(r.points).toBe(7);
		expect(r.areas[0]!.share).toBe(1);
	});

	it('marks grades in an area weighted 0 as ignored', () => {
		const r = halfYearPoints(
			[
				{ points: 10, typeId: 'klausur' },
				{ points: 2, typeId: 'praxis' }
			],
			types,
			{ schriftlich: 50, muendlich: 50, praktisch: 0 }
		)!;
		expect(r.points).toBe(10);
		expect(r.areas.find((a) => a.area === 'praktisch')).toMatchObject({ ignored: true, share: 0 });
	});

	it('still shows a grade if only zero-weighted areas have grades', () => {
		const r = halfYearPoints([{ points: 9, typeId: 'praxis' }], types, {
			schriftlich: 50,
			muendlich: 50,
			praktisch: 0
		})!;
		expect(r.points).toBe(9);
	});

	it('rounds half up and supports per-grade weights', () => {
		expect(
			halfYearPoints(
				[
					{ points: 10, typeId: 'klausur' },
					{ points: 11, typeId: 'klausur' }
				],
				types
			)?.points
		).toBe(11);
		const r = halfYearPoints(
			[
				{ points: 6, typeId: 'klausur', weight: 1 },
				{ points: 12, typeId: 'klausur', weight: 2 }
			],
			types
		)!;
		expect(r.exact).toBe(10);
	});

	it('returns null without grades and treats unknown types as written', () => {
		expect(halfYearPoints([], types)).toBeNull();
		expect(halfYearPoints([{ points: 8, typeId: 'gone' }], types)?.areas[0]!.area).toBe(
			'schriftlich'
		);
	});
});

describe('parsePercent / formatAreaWeights', () => {
	it('understands percentages and fractions', () => {
		expect(parsePercent('75')).toBe(75);
		expect(parsePercent('33,5 %')).toBe(33.5);
		expect(parsePercent('1/3')).toBeCloseTo(33.333);
		expect(parsePercent('2 / 3')).toBeCloseTo(66.667);
		expect(parsePercent('')).toBeNull();
		expect(parsePercent('120')).toBeNull();
		expect(parsePercent('abc')).toBeNull();
	});

	it('formats weights as percentages of their sum', () => {
		expect(formatAreaWeights({ schriftlich: 200 / 3, muendlich: 100 / 3, praktisch: 0 })).toBe(
			'Schriftlich 67 % · Mündlich 33 %'
		);
		expect(formatAreaWeights({ schriftlich: 50, muendlich: 20, praktisch: 10 })).toBe(
			'Schriftlich 63 % · Mündlich 25 % · Praktisch 13 %'
		);
	});
});
