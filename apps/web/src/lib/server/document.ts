import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
	OpError,
	applyToData,
	emptyData,
	migrateData,
	validateOp,
	type Data,
	type Snapshot
} from '@oberstufen-planer/app-core';
import { exportLegacyData } from './backup.ts';
import type { Db } from './db/index.ts';
import { appliedOps, settings, userDocument } from './db/schema.ts';

/**
 * The user's data as one document. On the first start after the update the old tables are
 * converted once (they stay in the database untouched as a fallback).
 */
export function getSnapshot(db: Db): Snapshot {
	const row = db.select().from(userDocument).where(eq(userDocument.id, 1)).get();
	if (row) return { revision: row.revision, data: migrateData(row.data) };
	let data: Data;
	try {
		data = migrateData(exportLegacyData(db));
	} catch {
		data = emptyData();
	}
	db.insert(userDocument)
		.values({ id: 1, revision: 1, data, updatedAt: Date.now() })
		.onConflictDoNothing()
		.run();
	return getSnapshot(db);
}

export function getRevision(db: Db): number {
	return getSnapshot(db).revision;
}

export interface OpResult {
	opId: string;
	ok: boolean;
	error?: string;
}

/**
 * Applies queued operations from a client in order. Each opId is applied only once, so
 * resending after a lost answer is harmless. Invalid operations are reported, not applied.
 */
export function applyOps(db: Db, queued: unknown): OpResult[] {
	if (!Array.isArray(queued) || queued.length > 500) throw new OpError('Ungültige Anfrage.');
	return db.transaction((tx) => {
		const current = getSnapshot(tx as unknown as Db);
		let data = current.data;
		let changed = false;
		const results: OpResult[] = [];
		for (const item of queued) {
			const opId = (item as { opId?: unknown })?.opId;
			if (typeof opId !== 'string' || !/^[\w-]{1,64}$/.test(opId))
				throw new OpError('Ungültige Anfrage.');
			if (tx.select().from(appliedOps).where(eq(appliedOps.opId, opId)).get()) {
				results.push({ opId, ok: true });
				continue;
			}
			try {
				const op = validateOp((item as { op?: unknown }).op);
				data = applyToData(data, op);
				changed = true;
				results.push({ opId, ok: true });
			} catch (e) {
				if (!(e instanceof OpError)) throw e;
				results.push({ opId, ok: false, error: e.message });
			}
			tx.insert(appliedOps).values({ opId, appliedAt: new Date() }).run();
		}
		if (changed) {
			tx.update(userDocument)
				.set({ data, revision: current.revision + 1, updatedAt: Date.now() })
				.where(eq(userDocument.id, 1))
				.run();
		}
		return results;
	});
}

/** Secret token of the calendar feed URL. */
export function getFeedToken(db: Db, regenerate = false): string {
	const row = db.select().from(settings).where(eq(settings.key, 'feedToken')).get();
	let token = regenerate ? null : (row?.value as string | undefined);
	if (!token) {
		token = randomBytes(24).toString('base64url');
		db.insert(settings)
			.values({ key: 'feedToken', value: token })
			.onConflictDoUpdate({ target: settings.key, set: { value: token } })
			.run();
	}
	return token;
}
