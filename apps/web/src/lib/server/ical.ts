import { toLocalDate, toLocalDateTime } from '$lib/calendar.ts';

export interface IcalEvent {
	uid: string;
	title: string;
	start: string;
	end: string | null;
	allDay: boolean;
	note: string;
}

function unfold(text: string): string[] {
	return text
		.replace(/\r\n/g, '\n')
		.replace(/\n[ \t]/g, '')
		.split('\n');
}

function unescape(v: string): string {
	return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

/**
 * Converts an iCal date value to local "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm".
 * UTC times (…Z) are converted to the server's time zone; times with TZID or floating
 * times are taken as local time (good enough for a German school calendar).
 */
function icalDate(value: string, isDate: boolean): { value: string; allDay: boolean } | null {
	const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
	if (!m) return null;
	const [, y, mo, d, h, mi, , z] = m;
	if (isDate || h === undefined) return { value: `${y}-${mo}-${d}`, allDay: true };
	if (z) {
		const date = new Date(Date.UTC(+y!, +mo! - 1, +d!, +h, +mi!));
		return { value: toLocalDateTime(date), allDay: false };
	}
	return { value: `${y}-${mo}-${d}T${h}:${mi}`, allDay: false };
}

/** Minimal RFC 5545 parser for VEVENTs (no recurrence expansion). */
export function parseIcal(text: string): IcalEvent[] {
	const events: IcalEvent[] = [];
	let cur: Record<string, { params: string; value: string }> | null = null;
	/** Depth of nested components inside the current VEVENT (e.g. VALARM). */
	let nested = 0;
	for (const line of unfold(text)) {
		if (line === 'BEGIN:VEVENT') {
			cur = {};
			nested = 0;
			continue;
		}
		if (cur && line.startsWith('BEGIN:')) {
			nested++;
			continue;
		}
		if (cur && nested > 0) {
			if (line.startsWith('END:')) nested--;
			continue;
		}
		if (line === 'END:VEVENT' && cur) {
			const start =
				cur.DTSTART && icalDate(cur.DTSTART.value, /VALUE=DATE(?!-)/.test(cur.DTSTART.params));
			if (start) {
				let end = cur.DTEND
					? icalDate(cur.DTEND.value, /VALUE=DATE(?!-)/.test(cur.DTEND.params))
					: null;
				// iCal all-day DTEND is exclusive: a one-day entry has no separate end for us
				if (start.allDay && end?.allDay) {
					const e = new Date(end.value + 'T00:00:00');
					e.setDate(e.getDate() - 1);
					const last = toLocalDate(e);
					end = last > start.value ? { value: last, allDay: true } : null;
				}
				events.push({
					uid: cur.UID ? unescape(cur.UID.value) : `${start.value}-${cur.SUMMARY?.value ?? ''}`,
					title: unescape(cur.SUMMARY?.value ?? 'Termin').slice(0, 200),
					start: start.value,
					end: end?.value ?? null,
					allDay: start.allDay,
					note: unescape(cur.DESCRIPTION?.value ?? '').slice(0, 1000)
				});
			}
			cur = null;
			continue;
		}
		if (!cur) continue;
		const colon = line.indexOf(':');
		if (colon < 0) continue;
		const head = line.slice(0, colon);
		const semi = head.indexOf(';');
		const name = (semi < 0 ? head : head.slice(0, semi)).toUpperCase();
		const params = semi < 0 ? '' : head.slice(semi + 1).toUpperCase();
		cur[name] = { params, value: line.slice(colon + 1) };
	}
	return events;
}

// ---- writing ----------------------------------------------------------------------------

function escape(v: string): string {
	return v
		.replace(/\\/g, '\\\\')
		.replace(/\n/g, '\\n')
		.replace(/([,;])/g, '\\$1');
}

/** Folds lines longer than 75 octets (RFC 5545 3.1). */
function fold(line: string): string {
	const bytes = new TextEncoder().encode(line);
	if (bytes.length <= 75) return line;
	const out: string[] = [];
	let cur = '';
	let len = 0;
	for (const ch of line) {
		const n = new TextEncoder().encode(ch).length;
		if (len + n > (out.length ? 74 : 75)) {
			out.push(cur);
			cur = '';
			len = 0;
		}
		cur += ch;
		len += n;
	}
	out.push(cur);
	return out.join('\r\n ');
}

const compact = (v: string) => v.replace(/[-:]/g, '');

export interface FeedEvent {
	id: string;
	title: string;
	start: string;
	end: string | null;
	allDay: boolean;
	note: string;
	reminders: number[];
}

export function buildIcal(events: FeedEvent[], now = new Date()): string {
	const stamp = now
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Oberstufen-Planer//DE',
		'CALSCALE:GREGORIAN',
		'X-WR-CALNAME:Oberstufen-Planer'
	];
	for (const e of events) {
		lines.push('BEGIN:VEVENT', `UID:${e.id}@oberstufen-planer`, `DTSTAMP:${stamp}`);
		if (e.allDay) {
			const last = new Date((e.end ?? e.start) + 'T00:00:00');
			last.setDate(last.getDate() + 1);
			lines.push(
				`DTSTART;VALUE=DATE:${compact(e.start)}`,
				`DTEND;VALUE=DATE:${compact(toLocalDate(last))}`
			);
		} else {
			lines.push(`DTSTART:${compact(e.start)}00`);
			if (e.end) lines.push(`DTEND:${compact(e.end)}00`);
		}
		lines.push(`SUMMARY:${escape(e.title)}`);
		if (e.note) lines.push(`DESCRIPTION:${escape(e.note)}`);
		for (const m of e.reminders) {
			lines.push(
				'BEGIN:VALARM',
				'ACTION:DISPLAY',
				`DESCRIPTION:${escape(e.title)}`,
				`TRIGGER:-PT${m}M`,
				'END:VALARM'
			);
		}
		lines.push('END:VEVENT');
	}
	lines.push('END:VCALENDAR');
	return lines.map(fold).join('\r\n') + '\r\n';
}
