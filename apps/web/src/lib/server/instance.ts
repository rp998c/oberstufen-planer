import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getConfig } from './config.ts';
import { openDb, type Db } from './db/index.ts';

let db: Db | undefined;

/** The app-wide database, opened lazily so that `vite build` never touches the data directory. */
export function getDb(): Db {
	if (!db) {
		const { dataDir, migrationsDir } = getConfig();
		mkdirSync(dataDir, { recursive: true });
		db = openDb(join(dataDir, 'app.db'), resolve(migrationsDir));
	}
	return db;
}
