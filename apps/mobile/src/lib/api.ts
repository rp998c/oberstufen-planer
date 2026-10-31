export class ApiError extends Error {
	constructor(
		message: string,
		public status: number
	) {
		super(message);
	}
}

/** No connection, server unreachable or timeout. */
export class OfflineError extends Error {}

/** Normalises what the user typed: adds http:// and removes trailing slashes. */
export function normaliseServerUrl(input: string): string {
	let url = input.trim();
	if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
	const parsed = new URL(url);
	return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;
}

export async function request<T>(
	server: string,
	path: string,
	options: { method?: string; token?: string | null; body?: unknown; timeoutMs?: number } = {}
): Promise<T> {
	const headers: Record<string, string> = { Accept: 'application/json' };
	if (options.body !== undefined) headers['Content-Type'] = 'application/json';
	if (options.token) headers.Authorization = `Bearer ${options.token}`;
	let res: Response;
	try {
		res = await Promise.race([
			fetch(`${server}${path}`, {
				method: options.method ?? 'GET',
				headers,
				body: options.body !== undefined ? JSON.stringify(options.body) : undefined
			}),
			new Promise<never>((_, reject) =>
				setTimeout(
					() => reject(new OfflineError('Zeitüberschreitung')),
					options.timeoutMs ?? 15_000
				)
			)
		]);
	} catch (e) {
		if (e instanceof OfflineError) throw e;
		throw new OfflineError('Server nicht erreichbar');
	}
	let data: unknown = null;
	try {
		data = await res.json();
	} catch {
		// non-JSON answer: not our server (or a proxy error page)
		if (res.ok)
			throw new ApiError('Unerwartete Antwort – ist das die richtige Adresse?', res.status);
	}
	if (!res.ok) {
		const message = (data as { error?: string } | null)?.error ?? `Fehler ${res.status}`;
		throw new ApiError(message, res.status);
	}
	return data as T;
}
