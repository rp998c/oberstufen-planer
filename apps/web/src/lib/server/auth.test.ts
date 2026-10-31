import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	LoginThrottle,
	changePassword,
	createSession,
	deleteOtherSessions,
	getPasswordHash,
	setInitialPassword,
	verifyPassword,
	deleteExpiredSessions,
	deleteSession,
	safeRedirectTarget,
	validateSession
} from './auth.ts';
import { openDb } from './db/index.ts';
import { sessions } from './db/schema.ts';

const migrations = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const DAY = 24 * 60 * 60 * 1000;

describe('sessions', () => {
	it('creates, validates and deletes a session', () => {
		const db = openDb(':memory:', migrations);
		const now = Date.now();
		const { token } = createSession(db, 90, now);
		expect(validateSession(db, token, 90, now)).toMatchObject({ renewed: false });
		deleteSession(db, token);
		expect(validateSession(db, token, 90, now)).toBeNull();
	});

	it('stores only a hash of the token', () => {
		const db = openDb(':memory:', migrations);
		const { token } = createSession(db, 90);
		const rows = db.select().from(sessions).all();
		expect(rows).toHaveLength(1);
		expect(rows[0]!.id).not.toBe(token);
	});

	it('rejects unknown and expired tokens', () => {
		const db = openDb(':memory:', migrations);
		const now = Date.now();
		const { token } = createSession(db, 1, now);
		expect(validateSession(db, 'nope', 1, now)).toBeNull();
		expect(validateSession(db, token, 1, now + 2 * DAY)).toBeNull();
		expect(db.select().from(sessions).all()).toHaveLength(0);
	});

	it('extends a session when less than half of its lifetime is left', () => {
		const db = openDb(':memory:', migrations);
		const now = Date.now();
		const { token } = createSession(db, 10, now);
		const later = now + 6 * DAY;
		const result = validateSession(db, token, 10, later);
		expect(result?.renewed).toBe(true);
		expect(result?.expiresAt.getTime()).toBe(later + 10 * DAY);
	});

	it('removes expired sessions in bulk', () => {
		const db = openDb(':memory:', migrations);
		const now = Date.now();
		createSession(db, 1, now - 5 * DAY);
		createSession(db, 90, now);
		deleteExpiredSessions(db, now);
		expect(db.select().from(sessions).all()).toHaveLength(1);
	});
});

describe('LoginThrottle', () => {
	it('locks after too many failures and unlocks after the window', () => {
		const t = new LoginThrottle(3, 1000);
		t.registerFailure(0);
		t.registerFailure(10);
		expect(t.isLocked(20)).toBe(false);
		t.registerFailure(30);
		expect(t.isLocked(40)).toBe(true);
		expect(t.isLocked(1040)).toBe(false);
	});

	it('resets after a successful login', () => {
		const t = new LoginThrottle(2, 1000);
		t.registerFailure(0);
		t.registerFailure(1);
		t.reset();
		expect(t.isLocked(2)).toBe(false);
	});
});

describe('safeRedirectTarget', () => {
	it('allows local paths only', () => {
		expect(safeRedirectTarget('/kalender?x=1')).toBe('/kalender?x=1');
		expect(safeRedirectTarget(null)).toBe('/');
		expect(safeRedirectTarget('https://evil.example')).toBe('/');
		expect(safeRedirectTarget('//evil.example')).toBe('/');
		expect(safeRedirectTarget('/\\evil.example')).toBe('/');
	});
});

describe('password in the app', () => {
	it('uses APP_PASSWORD_HASH first, otherwise the stored hash', async () => {
		const db = openDb(':memory:', migrations);
		expect(getPasswordHash(db, '')).toBeNull();
		expect(await setInitialPassword(db, 'geheim123')).toBe(true);
		const stored = getPasswordHash(db, '')!;
		expect(stored.startsWith('$argon2')).toBe(true);
		expect(getPasswordHash(db, '$argon2id$env')).toBe('$argon2id$env');
		expect(await verifyPassword(stored, 'geheim123')).toBe(true);
		expect(await verifyPassword(stored, 'falsch')).toBe(false);
	});

	it('sets the first password only once', async () => {
		const db = openDb(':memory:', migrations);
		const results = await Promise.all([
			setInitialPassword(db, 'erstes123'),
			setInitialPassword(db, 'zweites123')
		]);
		expect(results.filter(Boolean)).toHaveLength(1);
		expect(await setInitialPassword(db, 'drittes123')).toBe(false);
	});

	it('changes the password and logs out other devices', async () => {
		const db = openDb(':memory:', migrations);
		await setInitialPassword(db, 'alt12345');
		const mine = createSession(db, 90);
		const other = createSession(db, 90);
		await changePassword(db, 'neu12345');
		deleteOtherSessions(db, mine.token);
		expect(await verifyPassword(getPasswordHash(db, '')!, 'neu12345')).toBe(true);
		expect(validateSession(db, mine.token, 90)).not.toBeNull();
		expect(validateSession(db, other.token, 90)).toBeNull();
	});
});
