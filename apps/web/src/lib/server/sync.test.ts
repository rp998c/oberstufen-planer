import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { calculate } from '@oberstufen-planer/abi-engine-bw';
import {
	applyOp,
	planInputFromSnapshot,
	type Op,
	type Snapshot
} from '@oberstufen-planer/app-core';
import {
	createSubject,
	ensureDefaults,
	listGradeTypes,
	loadAll,
	setCourse,
	toPlanInput
} from './data.ts';
import { openDb } from './db/index.ts';
import { applyOps, buildSnapshot, getRevision } from './sync.ts';

const migrations = fileURLToPath(new URL('../../../drizzle', import.meta.url));

function setup() {
	const db = openDb(':memory:', migrations);
	ensureDefaults(db);
	const deutsch = createSubject(db, {
		name: 'Deutsch',
		category: 'deutsch',
		level: 'LF',
		exam: 'written',
		fromClass8: true,
		color: '#2563eb',
		halfYears: [1, 2, 3, 4]
	});
	const geo = createSubject(db, {
		name: 'Geographie',
		category: 'geographie',
		level: 'BF',
		exam: null,
		fromClass8: true,
		color: '#dc2626',
		halfYears: [1, 2]
	});
	setCourse(db, deutsch, 1, { points: 12 });
	return { db, deutsch, geo, typeId: listGradeTypes(db)[0]!.id };
}

const sortRows = (s: Snapshot) =>
	JSON.parse(
		JSON.stringify(s.data, (_k, v) =>
			Array.isArray(v)
				? [...v].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
				: v
		)
	);

let n = 0;
const q = (op: Op) => ({ opId: `op-${String(++n).padStart(6, '0')}`, op });

describe('sync', () => {
	it('increases the revision on every data change, not on secrets', () => {
		const { db, deutsch } = setup();
		const r0 = getRevision(db);
		setCourse(db, deutsch, 2, { points: 9 });
		const r1 = getRevision(db);
		expect(r1).toBeGreaterThan(r0);
		db.$client.prepare("INSERT INTO settings (key, value) VALUES ('vapid', '{}')").run();
		expect(getRevision(db)).toBe(r1);
	});

	it('the snapshot gives the same engine input as the web app', () => {
		const { db } = setup();
		expect(planInputFromSnapshot(buildSnapshot(db))).toEqual(toPlanInput(loadAll(db)));
	});

	it('server and app end up with identical data after the same operations', () => {
		const { db, deutsch, geo, typeId } = setup();
		let local = buildSnapshot(db);
		let seed = 3;
		const rnd = (k: number) => (seed = (seed * 1103515245 + 12345) % 2 ** 31) % k;
		const ops: Op[] = [];
		for (let i = 0; i < 200; i++) {
			const id = `id-${rnd(6)}`;
			const subjectId = [deutsch, geo, 'gone-subject'][rnd(3)]!;
			const halfYear = 1 + rnd(4);
			const pts = rnd(5) === 0 ? null : rnd(16);
			const pick = rnd(10);
			if (pick === 0)
				ops.push({
					type: 'grade.upsert',
					grade: {
						id,
						subjectId,
						halfYear,
						gradeTypeId: rnd(5) ? typeId : 'gone-type',
						points: pts,
						forecast: null,
						weight: 1,
						date: '2026-10-01',
						note: ''
					}
				});
			else if (pick === 1) ops.push({ type: 'grade.delete', id });
			else if (pick === 2) ops.push({ type: 'course.set', subjectId, halfYear, points: pts });
			else if (pick === 3) ops.push({ type: 'course.set', subjectId, halfYear, forecast: pts });
			else if (pick === 4) ops.push({ type: 'exam.set', subjectId, writtenForecast: pts });
			else if (pick === 5)
				ops.push({
					type: 'event.upsert',
					event: {
						id,
						subjectId: rnd(2) ? subjectId : null,
						title: `T${i}`,
						kind: 'klausur',
						start: '2026-11-20',
						end: null,
						allDay: true,
						note: '',
						reminders: [1440]
					}
				});
			else if (pick === 6) ops.push({ type: 'event.delete', id });
			else if (pick === 7)
				ops.push({
					type: 'task.upsert',
					task: {
						id,
						subjectId,
						title: `A${i}`,
						due: null,
						done: rnd(2) === 0,
						createdAt: 1_700_000_000_000 + i
					}
				});
			else if (pick === 8)
				ops.push({
					type: 'goal.upsert',
					goal: {
						id,
						subjectId: null,
						title: `Z${i}`,
						targetPoints: pts,
						due: null,
						achieved: false,
						createdAt: 1_700_000_000_000
					}
				});
			else ops.push({ type: 'task.delete', id });
		}
		for (const op of ops) local = applyOp(local, op);
		const results = applyOps(db, ops.map(q));
		expect(results.length).toBe(200);
		const server = buildSnapshot(db);
		expect(sortRows(server)).toEqual(sortRows(local));
		expect(calculate(planInputFromSnapshot(server)).total).toBe(
			calculate(planInputFromSnapshot(local)).total
		);
	});

	it('applies each operation only once', () => {
		const { db, deutsch } = setup();
		const item = q({
			type: 'task.upsert',
			task: {
				id: 'task-1',
				subjectId: deutsch,
				title: 'Lesen',
				due: null,
				done: false,
				createdAt: 1
			}
		});
		applyOps(db, [item]);
		applyOps(db, [
			q({
				type: 'task.upsert',
				task: {
					id: 'task-1',
					subjectId: deutsch,
					title: 'Geändert',
					due: null,
					done: false,
					createdAt: 1
				}
			})
		]);
		// resending the first operation must not undo the later change
		expect(applyOps(db, [item])[0]).toEqual({ opId: item.opId, ok: true });
		expect(buildSnapshot(db).data.tasks[0]!.title).toBe('Geändert');
	});

	it('rejects invalid operations with a message and keeps going', () => {
		const { db, deutsch } = setup();
		const results = applyOps(db, [
			q({ type: 'course.set', subjectId: deutsch, halfYear: 2, points: 16 }),
			q({ type: 'nope' } as unknown as Op),
			q({ type: 'course.set', subjectId: deutsch, halfYear: 2, points: 10 })
		]);
		expect(results.map((r) => r.ok)).toEqual([false, false, true]);
		expect(results[0]!.error).toMatch(/0 und 15/);
		expect(loadAll(db).subjects.find((s) => s.id === deutsch)!.courses[2]!.points).toBe(10);
	});
});
