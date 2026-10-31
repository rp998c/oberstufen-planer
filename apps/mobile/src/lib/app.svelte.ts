import { calculate } from '@oberstufen-planer/abi-engine-bw';
import {
	applyOp,
	emptySnapshot,
	planInputFromSnapshot,
	subjectCourses,
	validateOp,
	type Op,
	type QueuedOp,
	type Snapshot
} from '@oberstufen-planer/app-core';
import { ApiError, OfflineError, normaliseServerUrl, request } from './api.ts';
import { cancelAllReminders, rescheduleReminders } from './notifications.ts';
import { clearAll, load, save } from './storage.ts';

export interface Connection {
	server: string;
	token: string;
	device: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'offline' | 'unauthorized' | 'error';

interface SyncResponse {
	revision: number;
	changed: boolean;
	snapshot?: Snapshot;
}

interface PushResponse {
	revision: number;
	results: { opId: string; ok: boolean; error?: string }[];
}

const newId = () =>
	typeof crypto.randomUUID === 'function'
		? crypto.randomUUID()
		: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

class AppState {
	ready = $state(false);
	connection = $state<Connection | null>(null);
	snapshot = $state<Snapshot>(emptySnapshot());
	queue = $state<QueuedOp[]>([]);
	status = $state<SyncStatus>('idle');
	lastSync = $state<number | null>(null);
	message = $state<string | null>(null);

	/** Derived data used by several views. */
	courses = $derived(subjectCourses(this.snapshot));
	result = $derived(calculate(planInputFromSnapshot(this.snapshot)));

	#syncing: Promise<void> | null = null;
	#timer: ReturnType<typeof setTimeout> | undefined;

	async init() {
		this.connection = await load<Connection | null>('connection', null);
		this.snapshot = await load<Snapshot>('snapshot', emptySnapshot());
		this.queue = await load<QueuedOp[]>('queue', []);
		this.lastSync = await load<number | null>('lastSync', null);
		this.ready = true;
		if (this.connection) void this.sync();
	}

	/** Checks the address, logs in and downloads everything. Throws with a German message. */
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
			const { token } = await request<{ token: string }>(server, '/api/app/login', {
				method: 'POST',
				body: { password, device: device.trim() || 'Android' }
			});
			this.connection = { server, token, device: device.trim() || 'Android' };
			await save('connection', this.connection);
			this.snapshot = emptySnapshot();
			this.queue = [];
			await this.sync();
			if (this.status !== 'ok')
				throw new Error(this.message ?? 'Daten konnten nicht geladen werden.');
		} catch (e) {
			if (e instanceof OfflineError)
				throw new Error(
					'Server nicht erreichbar. Stimmt die Adresse und bist du im richtigen Netz?'
				);
			throw e;
		}
	}

	async logout() {
		await cancelAllReminders();
		await clearAll();
		this.connection = null;
		this.snapshot = emptySnapshot();
		this.queue = [];
		this.lastSync = null;
		this.status = 'idle';
		this.message = null;
	}

	/**
	 * Applies a change locally right away and queues it for the server.
	 * Throws OpError for invalid input (shown in the form).
	 */
	mutate(op: Op) {
		validateOp(op);
		this.snapshot = applyOp(this.snapshot, op);
		this.queue = [...this.queue, { opId: newId(), op }];
		void save('snapshot', $state.snapshot(this.snapshot));
		void save('queue', $state.snapshot(this.queue));
		void rescheduleReminders($state.snapshot(this.snapshot.data.events));
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => void this.sync(), 800);
	}

	newId = newId;

	/** Sends queued changes, then downloads the current data if it changed. */
	sync(): Promise<void> {
		if (!this.#syncing) {
			this.#syncing = this.#doSync().finally(() => (this.#syncing = null));
		}
		return this.#syncing;
	}

	async #doSync() {
		const conn = this.connection;
		if (!conn) return;
		this.status = 'syncing';
		try {
			// 1. push
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
				if (rejected.length) {
					this.message = `${rejected.length} Änderung(en) wurden vom Server abgelehnt: ${rejected[0]!.error}`;
				}
				this.queue = this.queue.filter((q) => !handled.has(q.opId));
				await save('queue', $state.snapshot(this.queue));
				if (!handled.size) break;
			}

			// 2. pull
			const res = await request<SyncResponse>(
				conn.server,
				`/api/sync?since=${this.snapshot.revision}`,
				{ token: conn.token, timeoutMs: 30_000 }
			);
			if (res.changed && res.snapshot) {
				// changes made while syncing are not on the server yet: apply them again
				let next = res.snapshot;
				for (const q of this.queue) next = applyOp(next, q.op);
				this.snapshot = next;
				await save('snapshot', $state.snapshot(this.snapshot));
			}
			this.lastSync = Date.now();
			await save('lastSync', this.lastSync);
			this.status = 'ok';
			if (!this.queue.length && this.message?.includes('abgelehnt') === false) this.message = null;
		} catch (e) {
			if (e instanceof OfflineError) {
				this.status = 'offline';
			} else if (e instanceof ApiError && e.status === 401) {
				this.status = 'unauthorized';
				this.message = 'Dieses Gerät wurde abgemeldet. Bitte neu verbinden.';
			} else {
				this.status = 'error';
				this.message = e instanceof Error ? e.message : String(e);
			}
		}
		await rescheduleReminders($state.snapshot(this.snapshot.data.events)).catch(() => 0);
	}
}

export const app = new AppState();
