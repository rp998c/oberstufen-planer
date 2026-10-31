export const EVENT_KINDS = {
	klausur: 'Klausur',
	gfs: 'GFS',
	abi: 'Abiturprüfung',
	sonstiges: 'Termin'
} as const;
export type EventKind = keyof typeof EVENT_KINDS;

/** Reminder presets in minutes before the start (all-day entries start at 00:00). */
export const REMINDER_PRESETS = [
	{ minutes: 10080, label: '1 Woche vorher' },
	{ minutes: 2880, label: '2 Tage vorher' },
	{ minutes: 1440, label: '1 Tag vorher' },
	{ minutes: 360, label: 'Am Vortag, 18 Uhr (ganztägig)' },
	{ minutes: 60, label: '1 Stunde vorher' }
] as const;

/** Parses "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" as local time. */
export function parseLocal(value: string): Date {
	const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
	if (!m) throw new Error(`Invalid local date: ${value}`);
	return new Date(+m[1]!, +m[2]! - 1, +m[3]!, m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalDate(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toLocalDateTime(d: Date): string {
	return `${toLocalDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatEventDate(start: string, allDay: boolean): string {
	const d = parseLocal(start);
	const date = d.toLocaleDateString('de-DE', {
		weekday: 'short',
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});
	return allDay ? date : `${date}, ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;
}

/** Whole days from today to the given local date (0 = today). */
export function daysUntil(start: string, now = new Date()): number {
	const a = parseLocal(start.slice(0, 10));
	const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}
