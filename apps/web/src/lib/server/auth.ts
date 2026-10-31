import { createHash, randomBytes } from 'node:crypto';
import { eq, lt, ne } from 'drizzle-orm';
import { hash, verify } from '@node-rs/argon2';
import type { Db } from './db/index.ts';
import { sessions, settings } from './db/schema.ts';

export const SESSION_COOKIE = 'op_session';
const DAY_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function createSession(
	db: Db,
	days: number,
	now = Date.now(),
	device: { kind?: 'browser' | 'app'; name?: string | null } = {}
) {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(now + days * DAY_MS);
	db.insert(sessions)
		.values({
			id: hashToken(token),
			createdAt: new Date(now),
			expiresAt,
			kind: device.kind ?? 'browser',
			name: device.name ?? null,
			lastSeenAt: new Date(now)
		})
		.run();
	return { token, expiresAt };
}

/**
 * Checks a session token. Expired sessions are deleted. Sessions with less than half of their
 * lifetime left are extended (sliding expiry); `renewed` tells the caller to refresh the cookie.
 */
export function validateSession(db: Db, token: string, days: number, now = Date.now()) {
	const id = hashToken(token);
	const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
	if (!row) return null;
	if (row.expiresAt.getTime() <= now) {
		db.delete(sessions).where(eq(sessions.id, id)).run();
		return null;
	}
	if (row.expiresAt.getTime() - now < (days * DAY_MS) / 2) {
		const expiresAt = new Date(now + days * DAY_MS);
		db.update(sessions)
			.set({ expiresAt, lastSeenAt: new Date(now) })
			.where(eq(sessions.id, id))
			.run();
		return { expiresAt, renewed: true };
	}
	if (!row.lastSeenAt || now - row.lastSeenAt.getTime() > 60 * 60 * 1000) {
		db.update(sessions)
			.set({ lastSeenAt: new Date(now) })
			.where(eq(sessions.id, id))
			.run();
	}
	return { expiresAt: row.expiresAt, renewed: false };
}

export function deleteSession(db: Db, token: string) {
	db.delete(sessions)
		.where(eq(sessions.id, hashToken(token)))
		.run();
}

export function deleteExpiredSessions(db: Db, now = Date.now()) {
	db.delete(sessions)
		.where(lt(sessions.expiresAt, new Date(now)))
		.run();
}

/** App logins (Android) with device name and last use. */
export function listAppSessions(db: Db) {
	return db
		.select({
			id: sessions.id,
			name: sessions.name,
			createdAt: sessions.createdAt,
			lastSeenAt: sessions.lastSeenAt
		})
		.from(sessions)
		.where(eq(sessions.kind, 'app'))
		.all();
}

export function deleteSessionById(db: Db, id: string) {
	db.delete(sessions).where(eq(sessions.id, id)).run();
}

/** Simple lockout for the single password: after `maxFailures` within `windowMs`, block for `windowMs`. */
export class LoginThrottle {
	private failures: number[] = [];

	constructor(
		private maxFailures = 5,
		private windowMs = 15 * 60 * 1000
	) {}

	private prune(now: number) {
		this.failures = this.failures.filter((t) => now - t < this.windowMs);
	}

	isLocked(now = Date.now()): boolean {
		this.prune(now);
		return this.failures.length >= this.maxFailures;
	}

	registerFailure(now = Date.now()) {
		this.prune(now);
		this.failures.push(now);
	}

	reset() {
		this.failures = [];
	}
}

/** Only allow redirects to local paths ("/foo"), never to other hosts ("//evil", "https://…"). */
export function safeRedirectTarget(target: string | null | undefined): string {
	if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
		return '/';
	}
	return target;
}

export function deleteOtherSessions(db: Db, keepToken: string) {
	db.delete(sessions)
		.where(ne(sessions.id, hashToken(keepToken)))
		.run();
}

// ---- password ---------------------------------------------------------------------------

/** The password hash: from APP_PASSWORD_HASH if set, otherwise the one stored in the app. */
export function getPasswordHash(db: Db, envHash: string): string | null {
	if (envHash) return envHash;
	const row = db.select().from(settings).where(eq(settings.key, 'passwordHash')).get();
	return typeof row?.value === 'string' ? row.value : null;
}

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Stores the first password. Returns false if a password exists already
 * (two browsers racing through the first-run page).
 */
export async function setInitialPassword(db: Db, password: string): Promise<boolean> {
	const value = await hash(password);
	const result = db
		.insert(settings)
		.values({ key: 'passwordHash', value })
		.onConflictDoNothing()
		.run();
	return result.changes === 1;
}

export async function changePassword(db: Db, password: string) {
	const value = await hash(password);
	db.insert(settings)
		.values({ key: 'passwordHash', value })
		.onConflictDoUpdate({ target: settings.key, set: { value } })
		.run();
}

export async function verifyPassword(hashValue: string, password: string): Promise<boolean> {
	return verify(hashValue, password).catch(() => false);
}

/** One lockout for all password checks (browser login and app login). */
export const loginThrottle = new LoginThrottle();
