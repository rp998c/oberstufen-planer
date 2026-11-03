import { parseLocal } from '@oberstufen-planer/app-core';

export const fmt1 = (x: number) => x.toFixed(1).replace('.', ',');
export const fmt2 = (x: number) => x.toFixed(2).replace('.', ',');
export const pct = (x: number) => `${Math.round(x * 100)} %`;

const DOW = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
/** "Fr 11.12." */
export function shortDate(date: string): string {
	const d = parseLocal(date.slice(0, 10));
	return `${DOW[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
}
export function dayMonth(date: string): string {
	const d = parseLocal(date.slice(0, 10));
	return `${d.getDate()}.${d.getMonth() + 1}.`;
}
export function weekday(date: string): string {
	return DOW[parseLocal(date.slice(0, 10)).getDay()]!;
}
export function timeOf(start: string): string | null {
	return start.length > 10 ? `${start.slice(11, 16)} Uhr` : null;
}
/** Parses "75", "33,5 %", "1/3", "2/3" into a percentage. */
export { parsePercent } from '@oberstufen-planer/abi-engine-bw';

/** Shows a weight compactly: 66.67 → "2/3", 33.33 → "1/3", 50 → "50". */
export function weightText(n: number): string {
	if (Math.abs(n - 200 / 3) < 0.01) return '2/3';
	if (Math.abs(n - 100 / 3) < 0.01) return '1/3';
	if (n === 0) return '';
	return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** "2/3 : 1/3", "75 : 25", "50 : 30 : 20" – the parts a subject has, as share of 100. */
export function weightsLabel(w: {
	schriftlich: number;
	muendlich: number;
	praktisch: number;
}): string {
	const total = w.schriftlich + w.muendlich + w.praktisch || 1;
	const parts = [w.schriftlich, w.muendlich, w.praktisch].map((x) => (x / total) * 100);
	const shown = w.praktisch > 0 ? parts : parts.slice(0, 2);
	return shown.map((p) => weightText(p) || '0').join(' : ');
}
