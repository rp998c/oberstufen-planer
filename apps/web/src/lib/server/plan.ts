import { calculate } from '@oberstufen-planer/abi-engine-bw';
import type { Db } from './db/index.ts';
import { loadAll, toPlanInput } from './data.ts';

/** Loads everything and runs the calculation. */
export function getPlan(db: Db) {
	const all = loadAll(db);
	const input = toPlanInput(all);
	return { all, input, result: calculate(input) };
}

/** Subject info the client needs to label things. */
export function subjectMeta(all: ReturnType<typeof loadAll>) {
	return all.subjects.map((s) => ({
		id: s.id,
		name: s.name,
		color: s.color,
		level: s.level,
		exam: s.exam,
		category: s.category
	}));
}
