import { describe, expect, it } from 'vitest';
import { buildIcal, parseIcal } from './ical.ts';

const sample = [
	'BEGIN:VCALENDAR',
	'VERSION:2.0',
	'BEGIN:VEVENT',
	'UID:a1@schule',
	'DTSTART;VALUE=DATE:20261109',
	'DTEND;VALUE=DATE:20261110',
	'SUMMARY:Studientag\\, unterrichtsfrei',
	'END:VEVENT',
	'BEGIN:VEVENT',
	'UID:a2@schule',
	'DTSTART;VALUE=DATE:20261221',
	'DTEND;VALUE=DATE:20270109',
	'SUMMARY:Weihnachtsferien',
	'END:VEVENT',
	'BEGIN:VEVENT',
	'UID:a3@schule',
	'DTSTART;TZID=Europe/Berlin:20261112T080000',
	'DTEND;TZID=Europe/Berlin:20261112T093000',
	'SUMMARY:Elternabend mit einem sehr langen Titel der über die Zeilenlänge hinausg',
	' eht',
	'DESCRIPTION:Raum 101\\nBitte pünktlich',
	'END:VEVENT',
	'BEGIN:VEVENT',
	'UID:a4@schule',
	'DTSTART:20260601T060000Z',
	'SUMMARY:Sommer UTC',
	'END:VEVENT',
	'END:VCALENDAR'
].join('\r\n');

describe('parseIcal', () => {
	it('parses all-day, multi-day, local and UTC events', () => {
		const ev = parseIcal(sample);
		expect(ev).toHaveLength(4);
		expect(ev[0]).toMatchObject({
			uid: 'a1@schule',
			title: 'Studientag, unterrichtsfrei',
			start: '2026-11-09',
			end: null,
			allDay: true
		});
		// DTEND of all-day events is exclusive
		expect(ev[1]).toMatchObject({ start: '2026-12-21', end: '2027-01-08', allDay: true });
		expect(ev[2]).toMatchObject({
			start: '2026-11-12T08:00',
			end: '2026-11-12T09:30',
			allDay: false,
			title: 'Elternabend mit einem sehr langen Titel der über die Zeilenlänge hinausgeht',
			note: 'Raum 101\nBitte pünktlich'
		});
		// 06:00 UTC = 08:00 in Berlin summer time (TZ=Europe/Berlin in the test env)
		expect(ev[3]!.start).toBe('2026-06-01T08:00');
	});

	it('ignores broken entries', () => {
		expect(
			parseIcal('BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:x\nEND:VEVENT\nEND:VCALENDAR')
		).toEqual([]);
	});
});

describe('buildIcal', () => {
	it('writes a feed that parses back to the same events', () => {
		const text = buildIcal([
			{
				id: 'e1',
				title: 'Klausur Mathe; Analysis',
				start: '2026-11-20',
				end: null,
				allDay: true,
				note: '',
				reminders: [1440]
			},
			{
				id: 'e2',
				title: 'Mündliche Prüfung',
				start: '2027-05-03T10:15',
				end: '2027-05-03T10:45',
				allDay: false,
				note: 'Raum B',
				reminders: []
			},
			{
				id: 'e3',
				title: 'Projektwoche',
				start: '2027-02-01',
				end: '2027-02-05',
				allDay: true,
				note: '',
				reminders: []
			}
		]);
		expect(text).toContain('TRIGGER:-PT1440M');
		expect(text.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
		const back = parseIcal(text);
		expect(back.map(({ uid, ...rest }) => rest)).toEqual([
			{ title: 'Klausur Mathe; Analysis', start: '2026-11-20', end: null, allDay: true, note: '' },
			{
				title: 'Mündliche Prüfung',
				start: '2027-05-03T10:15',
				end: '2027-05-03T10:45',
				allDay: false,
				note: 'Raum B'
			},
			{ title: 'Projektwoche', start: '2027-02-01', end: '2027-02-05', allDay: true, note: '' }
		]);
		expect(back[0]!.uid).toBe('e1@oberstufen-planer');
	});

	it('folds long lines with multi-byte characters correctly', () => {
		const title = 'Ä'.repeat(100);
		const text = buildIcal([
			{ id: 'x', title, start: '2026-01-01', end: null, allDay: true, note: '', reminders: [] }
		]);
		expect(text.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
		expect(parseIcal(text)[0]!.title).toBe(title);
	});
});
