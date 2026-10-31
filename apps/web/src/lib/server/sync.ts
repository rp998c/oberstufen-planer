import { and, eq } from 'drizzle-orm';
import {
	OpError,
	validateOp,
	type Op,
	type Snapshot,
	type SnapshotSettings
} from '@oberstufen-planer/app-core';
import { exportData } from './backup.ts';
import type { Db } from './db/index.ts';
import {
	appliedOps,
	courses,
	events,
	exams,
	gradeTypes,
	grades,
	sentReminders,
	studyGoals,
	subjects,
	syncMeta,
	tasks
} from './db/schema.ts';

export function getRevision(db: Db): number {
	return db.select().from(syncMeta).where(eq(syncMeta.id, 1)).get()?.revision ?? 0;
}

/** All user data for the app. Timestamps become epoch milliseconds. */
export function buildSnapshot(db: Db): Snapshot {
	const backup = exportData(db);
	const data = backup.data as unknown as Snapshot['data'];
	const ms = (v: unknown) => (v instanceof Date ? v.getTime() : new Date(v as string).getTime());
	return {
		revision: getRevision(db),
		settings: backup.settings as SnapshotSettings,
		data: {
			...data,
			tasks: data.tasks.map((t) => ({ ...t, createdAt: ms(t.createdAt) })),
			studyGoals: data.studyGoals.map((g) => ({ ...g, createdAt: ms(g.createdAt) }))
		}
	};
}

const subjectExists = (db: Db, id: string | null) =>
	id === null || !!db.select().from(subjects).where(eq(subjects.id, id)).get();

/** Applies one validated operation. Throws OpError if it refers to something that doesn't exist. */
function applyOpToDb(db: Db, op: Op) {
	switch (op.type) {
		case 'grade.upsert': {
			const g = op.grade;
			const course = db
				.select()
				.from(courses)
				.where(and(eq(courses.subjectId, g.subjectId), eq(courses.halfYear, g.halfYear)))
				.get();
			if (!course) throw new OpError('Der Kurs existiert nicht mehr.');
			if (!db.select().from(gradeTypes).where(eq(gradeTypes.id, g.gradeTypeId)).get()) {
				throw new OpError('Die Notenart existiert nicht mehr.');
			}
			db.insert(grades).values(g).onConflictDoUpdate({ target: grades.id, set: g }).run();
			return;
		}
		case 'grade.delete':
			db.delete(grades).where(eq(grades.id, op.id)).run();
			return;
		case 'course.set': {
			const where = and(eq(courses.subjectId, op.subjectId), eq(courses.halfYear, op.halfYear));
			if (!db.select().from(courses).where(where).get())
				throw new OpError('Der Kurs existiert nicht mehr.');
			const set: { points?: number | null; forecast?: number | null } = {};
			if (op.points !== undefined) set.points = op.points;
			if (op.forecast !== undefined) set.forecast = op.forecast;
			if (Object.keys(set).length) db.update(courses).set(set).where(where).run();
			return;
		}
		case 'exam.set': {
			if (!subjectExists(db, op.subjectId)) throw new OpError('Das Fach existiert nicht mehr.');
			const set: Record<string, number | null> = {};
			for (const k of ['written', 'oral', 'writtenForecast', 'oralForecast'] as const) {
				if (op[k] !== undefined) set[k] = op[k]!;
			}
			db.insert(exams)
				.values({ subjectId: op.subjectId, ...set })
				.onConflictDoUpdate({
					target: exams.subjectId,
					set: Object.keys(set).length ? set : { subjectId: op.subjectId }
				})
				.run();
			return;
		}
		case 'event.upsert': {
			const e = {
				...op.event,
				subjectId: subjectExists(db, op.event.subjectId) ? op.event.subjectId : null
			};
			const { id, ...rest } = e;
			const existing = db.select().from(events).where(eq(events.id, id)).get();
			if (existing) {
				db.update(events).set(rest).where(eq(events.id, id)).run();
				db.delete(sentReminders).where(eq(sentReminders.eventId, id)).run();
			} else {
				db.insert(events).values(e).run();
			}
			return;
		}
		case 'event.delete':
			db.delete(events).where(eq(events.id, op.id)).run();
			return;
		case 'task.upsert': {
			const t = {
				...op.task,
				subjectId: subjectExists(db, op.task.subjectId) ? op.task.subjectId : null,
				createdAt: new Date(op.task.createdAt)
			};
			db.insert(tasks).values(t).onConflictDoUpdate({ target: tasks.id, set: t }).run();
			return;
		}
		case 'task.delete':
			db.delete(tasks).where(eq(tasks.id, op.id)).run();
			return;
		case 'goal.upsert': {
			const g = {
				...op.goal,
				subjectId: subjectExists(db, op.goal.subjectId) ? op.goal.subjectId : null,
				createdAt: new Date(op.goal.createdAt)
			};
			db.insert(studyGoals).values(g).onConflictDoUpdate({ target: studyGoals.id, set: g }).run();
			return;
		}
		case 'goal.delete':
			db.delete(studyGoals).where(eq(studyGoals.id, op.id)).run();
			return;
	}
}

export interface OpResult {
	opId: string;
	ok: boolean;
	error?: string;
}

/**
 * Applies operations in order, each in its own transaction. Operations that were applied
 * before (same opId) are skipped, so the app can safely resend after a lost connection.
 * Rejected operations are reported; the app then drops them.
 */
export function applyOps(db: Db, list: unknown): OpResult[] {
	if (!Array.isArray(list)) throw new OpError('Ungültige Anfrage.');
	if (list.length > 1000) throw new OpError('Zu viele Änderungen auf einmal.');
	const results: OpResult[] = [];
	for (const item of list) {
		const opId = (item as { opId?: unknown })?.opId;
		if (typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) {
			results.push({ opId: String(opId), ok: false, error: 'Ungültige Änderung.' });
			continue;
		}
		if (db.select().from(appliedOps).where(eq(appliedOps.opId, opId)).get()) {
			results.push({ opId, ok: true });
			continue;
		}
		try {
			const op = validateOp((item as { op?: unknown }).op);
			db.transaction((tx) => {
				applyOpToDb(tx as unknown as Db, op);
				tx.insert(appliedOps).values({ opId, appliedAt: new Date() }).run();
			});
			results.push({ opId, ok: true });
		} catch (e) {
			if (e instanceof OpError) {
				results.push({ opId, ok: false, error: e.message });
			} else {
				console.error('Sync: operation failed', e);
				results.push({ opId, ok: false, error: 'Änderung konnte nicht gespeichert werden.' });
			}
		}
	}
	return results;
}
