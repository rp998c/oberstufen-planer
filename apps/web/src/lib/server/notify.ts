import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { getSetting, setSetting } from './data.ts';
import type { Db } from './db/index.ts';
import { pushSubscriptions } from './db/schema.ts';

export interface NtfyConfig {
	server: string;
	topic: string;
	token?: string;
}

export interface Notification {
	title: string;
	body: string;
	url?: string;
}

/** VAPID keys are generated once and kept in the database. */
export function getVapidKeys(db: Db): { publicKey: string; privateKey: string } {
	let keys = getSetting<{ publicKey: string; privateKey: string } | null>(db, 'vapid', null);
	if (!keys) {
		keys = webpush.generateVAPIDKeys();
		setSetting(db, 'vapid', keys);
	}
	return keys;
}

export const getNtfy = (db: Db) => getSetting<NtfyConfig | null>(db, 'ntfy', null);

async function sendPush(db: Db, n: Notification): Promise<number> {
	const subs = db.select().from(pushSubscriptions).all();
	if (!subs.length) return 0;
	const { publicKey, privateKey } = getVapidKeys(db);
	const origin = env.ORIGIN ?? '';
	const subject = origin.startsWith('https://') ? origin : 'mailto:oberstufen-planer@localhost';
	let sent = 0;
	for (const s of subs) {
		try {
			await webpush.sendNotification(
				{ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
				JSON.stringify(n),
				{ vapidDetails: { subject, publicKey, privateKey }, TTL: 60 * 60 * 24 }
			);
			sent++;
		} catch (e) {
			const status = (e as { statusCode?: number }).statusCode;
			if (status === 404 || status === 410) {
				// subscription expired or was revoked on the device
				db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint)).run();
			} else {
				console.error('Web Push failed', status ?? e);
			}
		}
	}
	return sent;
}

async function sendNtfy(config: NtfyConfig, n: Notification): Promise<boolean> {
	const url = `${config.server.replace(/\/+$/, '')}/${encodeURIComponent(config.topic)}`;
	// ntfy reads non-ASCII header values as RFC 2047 encoded words
	const title = /^[\x20-\x7e]*$/.test(n.title)
		? n.title
		: `=?UTF-8?B?${Buffer.from(n.title, 'utf8').toString('base64')}?=`;
	const headers: Record<string, string> = { Title: title, Tags: 'calendar' };
	if (config.token) headers.Authorization = `Bearer ${config.token}`;
	const res = await fetch(url, { method: 'POST', body: n.body, headers }).catch((e) => {
		console.error('ntfy failed', e);
		return null;
	});
	if (res && !res.ok) console.error('ntfy failed', res.status);
	return res?.ok ?? false;
}

/** Sends a notification to all channels. Returns the number of successful deliveries. */
export async function notify(db: Db, n: Notification): Promise<number> {
	let count = await sendPush(db, n);
	const ntfy = getNtfy(db);
	if (ntfy?.topic) count += (await sendNtfy(ntfy, n)) ? 1 : 0;
	return count;
}
