import { env } from '$env/dynamic/private';

export type AuthMode = 'password' | 'none';

export interface Config {
	auth: AuthMode;
	/** Hash from APP_PASSWORD_HASH, or '' if the password is managed in the app. */
	passwordHash: string;
	dataDir: string;
	migrationsDir: string;
	sessionDays: number;
}

let cached: Config | undefined;

/** Reads and validates the configuration from environment variables. Throws with a clear message. */
export function getConfig(): Config {
	if (cached) return cached;

	const auth = (env.AUTH ?? 'password').trim().toLowerCase();
	if (auth !== 'password' && auth !== 'none') {
		throw new Error(`AUTH must be "password" or "none", got "${env.AUTH}"`);
	}

	// Optional: without it, the password is set in the app on first start and kept in the database.
	const passwordHash = (env.APP_PASSWORD_HASH ?? '').trim();
	if (passwordHash && !passwordHash.startsWith('$argon2')) {
		throw new Error(
			'APP_PASSWORD_HASH is not an Argon2 hash. Remove it to set the password in the app, ' +
				'or create one with "docker run --rm -it <image> hash-password".'
		);
	}

	const sessionDays = Number(env.SESSION_DAYS ?? 90);
	if (!Number.isFinite(sessionDays) || sessionDays <= 0) {
		throw new Error(`SESSION_DAYS must be a positive number, got "${env.SESSION_DAYS}"`);
	}

	cached = {
		auth,
		passwordHash,
		dataDir: env.DATA_DIR ?? 'data',
		migrationsDir: env.MIGRATIONS_DIR ?? 'drizzle',
		sessionDays
	};
	return cached;
}
