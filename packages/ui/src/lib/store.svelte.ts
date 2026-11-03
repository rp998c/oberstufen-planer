import {
	abiResult,
	applyOp,
	emptySnapshot,
	halfYearOf,
	subjectViews,
	todayLocal,
	validateOp,
	type Data,
	type Op,
	type QueuedOp,
	type Snapshot
} from '@oberstufen-planer/app-core';
import { ApiError, OfflineError, normaliseServerUrl, request } from './api.ts';
import type { Platform } from './platform.ts';

export interface Connection {
	/** '' = same origin (web). */
	server: string;
	/** null = cookie login (web). */
	token: string | null;
	device: string;
}

export type SyncStatus = 'local' | 'syncing' | 'ok' | 'offline' | 'unauthorized' | 'error';

export interface Prefs {
	theme: 'dark' | 'light' | 'system';
	accent: 'blau' | 'violett' | 'petrol' | 'orange' | 'rose';
	icon: 'A' | 'C';
	collapsed: boolean;
	/** The first-start screen was passed (app). */
	started: boolean;
}

const DEFAULT_PREFS: Prefs = {
	theme: 'dark',
	accent: 'blau',
	icon: 'A',
	collapsed: false,
	started: false
};

interface SyncResponse {
	revision: number;
	changed: boolean;
	snapshot?: Snapshot;
}
interface PushResponse {
	revision: number;
	results: { opId: string; ok: boolean; error?: string }[];
}

const KEYS = {
	snapshot: 'op2.snapshot',
	queue: 'op2.queue',
	conn: 'op2.connection',
	prefs: 'op2.prefs',
	last: 'op2.lastSync'
};

export const newId = () =>
	typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
		? crypto.randomUUID()
		: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export class AppStore {
	platform!: Platform;
	ready = $state(false);
	snapshot = $state<Snapshot>(emptySnapshot());
	queue = $state<QueuedOp[]>([]);
	connection = $state<Connection | null>(null);
	status = $state<SyncStatus>('local');
	message = $state<string | null>(null);
	lastSync = $state<number | null>(null);
	prefs = $state<Prefs>({ ...DEFAULT_PREFS });
	/** Server and phone both have data after connecting: the user decides which to keep. */
	conflict = $state<Snapshot | null>(null);
	today = $state(todayLocal());

	data = $derived(this.snapshot.data);
	views = $derived(subjectViews(this.snapshot.data));
	result = $derived(abiResult(this.snapshot.data));
	currentHalfYear = $derived(halfYearOf(this.today, this.snapshot.data.profile.abiYear));

	#syncing: Promise<void> | null = null;
	#timer: ReturnType<typeof setTimeout> | undefined;

	async init(platform: Platform) {
		this.platform = platform;
		this.prefs = { ...DEFAULT_PREFS, ...(await platform.load<Partial<Prefs>>(KEYS.prefs, {})) };
		this.snapshot = await platform.load<Snapshot>(KEYS.snapshot, emptySnapshot());
		if (this.snapshot.data?.version !== 2) this.snapshot = emptySnapshot();
		this.queue = await platform.load<QueuedOp[]>(KEYS.queue, []);
		this.lastSync = await platform.load<number | null>(KEYS.last, null);
		if (platform.sameOriginServer) {
			this.connection = { server: '', token: null, device: 'Browser' };
		} else {
			this.connection = await platform.load<Connection | null>(KEYS.conn, null);
			// app versions before the redesign: keep the login, the data comes from the server again
			const old = await platform.load<{ server: string; token: string; device: string } | null>(
				'connection',
				null
			);
			if (old && !this.connection) {
				this.connection = old;
				this.snapshot = emptySnapshot();
				this.queue = [];
				this.prefs.started = true;
				await platform.save(KEYS.conn, old);
				await platform.remove('connection');
				await platform.remove('snapshot');
				await platform.remove('queue');
			}
		}
		this.status = this.connection ? 'syncing' : 'local';
		this.ready = true;
		if (this.connection) await this.sync();
		setInterval(() => (this.today = todayLocal()), 60_000);
	}

	savePrefs(patch: Partial<Prefs>) {
		this.prefs = { ...this.prefs, ...patch };
		void this.platform.save(KEYS.prefs, $state.snapshot(this.prefs));
	}

	/** Applies a change at once (throws OpError with a German message if invalid). */
	mutate(op: Op) {
		validateOp(op);
		const eventsBefore = this.snapshot.data.events;
		this.snapshot = applyOp(this.snapshot, op);
		if (this.connection) this.queue = [...this.queue, { opId: newId(), op }];
		void this.#persist();
		if (this.snapshot.data.events !== eventsBefore) void this.#reminders();
		if (this.connection) {
			clearTimeout(this.#timer);
			this.#timer = setTimeout(() => void this.sync(), 600);
		}
	}

	async #persist() {
		await this.platform.save(KEYS.snapshot, $state.snapshot(this.snapshot));
		await this.platform.save(KEYS.queue, $state.snapshot(this.queue));
	}

	async #reminders() {
		await this.platform
			.scheduleReminders?.($state.snapshot(this.snapshot.data.events))
			.catch(() => undefined);
	}

	/** Sends queued changes, then downloads the current data if it changed. */
	sync(): Promise<void> {
		if (!this.connection) return Promise.resolve();
		if (!this.#syncing) this.#syncing = this.#doSync().finally(() => (this.#syncing = null));
		return this.#syncing;
	}

	async #doSync() {
		const conn = this.connection;
		if (!conn) return;
		this.status = 'syncing';
		try {
			while (this.queue.length) {
				const batch = $state.snapshot(this.queue.slice(0, 200));
				const res = await request<PushResponse>(conn.server, '/api/sync', {
					method: 'POST',
					token: conn.token,
					body: { ops: batch },
					timeoutMs: 30_000
				});
				const handled = new Set(res.results.map((r) => r.opId));
				const rejected = res.results.filter((r) => !r.ok);
				if (rejected.length)
					this.message = `Eine Änderung wurde vom Server abgelehnt: ${rejected[0]!.error}`;
				this.queue = this.queue.filter((q) => !handled.has(q.opId));
				await this.platform.save(KEYS.queue, $state.snapshot(this.queue));
				if (!handled.size) break;
			}
			const res = await request<SyncResponse>(
				conn.server,
				`/api/sync?since=${this.snapshot.revision}`,
				{
					token: conn.token,
					timeoutMs: 30_000
				}
			);
			if (res.changed && res.snapshot) {
				let next = res.snapshot;
				for (const q of this.queue) next = applyOp(next, q.op);
				const eventsBefore = this.snapshot.data.events;
				this.snapshot = next;
				await this.#persist();
				if (JSON.stringify(eventsBefore) !== JSON.stringify(next.data.events))
					void this.#reminders();
			}
			this.lastSync = Date.now();
			await this.platform.save(KEYS.last, this.lastSync);
			this.status = 'ok';
		} catch (e) {
			if (e instanceof OfflineError) this.status = 'offline';
			else if (e instanceof ApiError && e.status === 401) {
				this.status = 'unauthorized';
				if (this.platform.sameOriginServer) this.platform.onUnauthorized?.();
				else this.message = 'Dieses Gerät wurde vom Server abgemeldet. Bitte neu verbinden.';
			} else {
				this.status = 'error';
				this.message = e instanceof Error ? e.message : String(e);
			}
		}
	}

	/**
	 * App: connects to a server. If only one side has data, that side wins; if both have data,
	 * `conflict` is set and the user chooses (resolveConflict).
	 */
	async connect(serverInput: string, password: string, device: string) {
		let server: string;
		try {
			server = normaliseServerUrl(serverInput);
		} catch {
			throw new Error('Bitte eine gültige Adresse eingeben, z. B. http://192.168.1.10:3000');
		}
		try {
			const info = await request<{ app?: string; passwordSet?: boolean }>(server, '/api/app/info');
			if (info.app !== 'oberstufen-planer')
				throw new Error('Unter dieser Adresse läuft kein Oberstufen-Planer.');
			if (!info.passwordSet) throw new Error('Bitte zuerst im Browser ein Passwort festlegen.');
			const name = device.trim() || 'Handy';
			const { token } = await request<{ token: string }>(server, '/api/app/login', {
				method: 'POST',
				body: { password, device: name }
			});
			const remote = await request<SyncResponse>(server, '/api/sync?since=-1', {
				token,
				timeoutMs: 30_000
			});
			const conn: Connection = { server, token, device: name };
			const localHasData = this.snapshot.data.subjects.length > 0;
			const remoteHasData = (remote.snapshot?.data.subjects.length ?? 0) > 0;
			this.connection = conn;
			await this.platform.save(KEYS.conn, conn);
			if (localHasData && remoteHasData) {
				this.conflict = remote.snapshot!;
				return;
			}
			if (localHasData) await this.#upload();
			else this.snapshot = { revision: 0, data: this.snapshot.data };
			await this.sync();
		} catch (e) {
			if (e instanceof OfflineError)
				throw new Error(
					'Server nicht erreichbar. Stimmt die Adresse und bist du im richtigen Netz?'
				);
			throw e;
		}
	}

	async #upload() {
		this.queue = [
			{
				opId: newId(),
				op: { type: 'data.replace', data: $state.snapshot(this.snapshot.data) as Data }
			}
		];
		this.snapshot = { ...this.snapshot, revision: 0 };
		await this.#persist();
	}

	async resolveConflict(keep: 'device' | 'server') {
		const remote = this.conflict;
		this.conflict = null;
		if (!remote) return;
		if (keep === 'device') await this.#upload();
		else {
			this.snapshot = remote;
			this.queue = [];
			await this.#persist();
			void this.#reminders();
		}
		await this.sync();
	}

	/** App: stops syncing. The data stays on the phone. */
	async disconnect() {
		const conn = this.connection;
		if (conn?.token) {
			await request(conn.server, '/api/app/logout', { method: 'POST', token: conn.token }).catch(
				() => undefined
			);
		}
		this.connection = null;
		this.queue = [];
		this.status = 'local';
		this.message = null;
		this.snapshot = { ...this.snapshot, revision: 0 };
		await this.platform.remove(KEYS.conn);
		await this.#persist();
	}

	/** Replaces everything (restore from a backup file). */
	replaceAll(data: Data) {
		this.mutate({ type: 'data.replace', data });
		void this.#reminders();
	}
}

export const store = new AppStore();
