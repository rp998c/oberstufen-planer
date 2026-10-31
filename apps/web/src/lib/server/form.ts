import { HALF_YEARS, type Category, type HalfYear } from '@oberstufen-planer/abi-engine-bw';
import { CATEGORY_LABELS } from '@oberstufen-planer/abi-engine-bw';

export class FormError extends Error {}

export function str(
	fd: FormData,
	name: string,
	{ required = false, max = 200, label = name } = {}
): string {
	const v = fd.get(name);
	const s = typeof v === 'string' ? v.trim() : '';
	if (required && !s) throw new FormError(`Bitte „${label}“ ausfüllen.`);
	if (s.length > max) throw new FormError(`„${label}“ ist zu lang (max. ${max} Zeichen).`);
	return s;
}

/** Integer in [min, max] or null if empty. */
export function intOrNull(
	fd: FormData,
	name: string,
	min = 0,
	max = 15,
	label = name
): number | null {
	const s = str(fd, name);
	if (s === '') return null;
	const n = Number(s);
	if (!Number.isInteger(n) || n < min || n > max) {
		throw new FormError(`${label}: bitte eine ganze Zahl von ${min} bis ${max} eingeben.`);
	}
	return n;
}

export function num(fd: FormData, name: string, min: number, max: number, label = name): number {
	const s = str(fd, name, { required: true, label });
	const n = Number(s.replace(',', '.'));
	if (!Number.isFinite(n) || n < min || n > max) {
		throw new FormError(`${label}: bitte eine Zahl von ${min} bis ${max} eingeben.`);
	}
	return n;
}

export function bool(fd: FormData, name: string): boolean {
	const v = fd.get(name);
	return v === 'on' || v === 'true' || v === '1';
}

export function isoDateOrNull(fd: FormData, name: string): string | null {
	const s = str(fd, name);
	if (!s) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
		throw new FormError('Bitte ein gültiges Datum eingeben.');
	}
	return s;
}

export function category(value: unknown): Category {
	if (typeof value === 'string' && value in CATEGORY_LABELS) return value as Category;
	throw new FormError('Ungültige Fachkategorie.');
}

export function halfYear(value: unknown): HalfYear {
	const n = Number(value);
	if (HALF_YEARS.includes(n as HalfYear)) return n as HalfYear;
	throw new FormError('Ungültiges Halbjahr.');
}

export function halfYearList(values: unknown[]): HalfYear[] {
	return [...new Set(values.map(halfYear))].sort();
}

export function color(value: unknown): string {
	if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) return value;
	throw new FormError('Ungültige Farbe.');
}
