import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Login sessions. `id` is the SHA-256 of the cookie token, so a leaked DB can't be used to log in. */
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
});

/** Key/value store for app settings (Abitur year, reminder defaults, …). */
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value', { mode: 'json' }).notNull()
});
