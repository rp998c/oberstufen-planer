import { env } from '$env/dynamic/private';

export type AuthMode = 'password' | 'none';

export interface Config {
	auth: AuthMode;
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

	const passwordHash = (env.APP_PASSWORD_HASH ?? '').trim();
	if (auth === 'password' && !passwordHash.startsWith('$argon2')) {
		throw new Error(
			'APP_PASSWORD_HASH is missing or not an Argon2 hash. Create one with ' +
				'"docker run --rm -it <image> hash-password" (or "pnpm --filter web hash-password"), ' +
				'or set AUTH=none if the app runs behind your own authentication.'
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
