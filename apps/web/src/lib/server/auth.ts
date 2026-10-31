import { createHash, randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import type { Db } from './db/index.ts';
import { sessions } from './db/schema.ts';

export const SESSION_COOKIE = 'op_session';
const DAY_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function createSession(db: Db, days: number, now = Date.now()) {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(now + days * DAY_MS);
	db.insert(sessions)
		.values({ id: hashToken(token), createdAt: new Date(now), expiresAt })
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
		db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id)).run();
		return { expiresAt, renewed: true };
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
