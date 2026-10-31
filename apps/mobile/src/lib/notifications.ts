import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { plannedNotifications, type EventRow } from '@oberstufen-planer/app-core';

export async function notificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
	try {
		const { display } = await LocalNotifications.checkPermissions();
		return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
	} catch {
		return 'denied';
	}
}

export async function requestNotificationPermission(): Promise<boolean> {
	try {
		return (await LocalNotifications.requestPermissions()).display === 'granted';
	} catch {
		return false;
	}
}

/**
 * Replaces all scheduled reminders with the ones from the current events. The phone shows
 * them itself – no push server and no internet connection needed.
 */
export async function rescheduleReminders(events: EventRow[]): Promise<number> {
	if (!Capacitor.isNativePlatform()) return 0;
	if ((await notificationPermission()) !== 'granted') return 0;
	const pending = await LocalNotifications.getPending();
	if (pending.notifications.length) {
		await LocalNotifications.cancel({
			notifications: pending.notifications.map((n) => ({ id: n.id }))
		});
	}
	const planned = plannedNotifications(events);
	if (!planned.length) return 0;
	await LocalNotifications.schedule({
		notifications: planned.map((n) => ({
			id: n.id,
			title: n.title,
			body: n.body,
			schedule: { at: n.at, allowWhileIdle: true }
		}))
	});
	return planned.length;
}

export async function cancelAllReminders() {
	if (!Capacitor.isNativePlatform()) return;
	const pending = await LocalNotifications.getPending();
	if (pending.notifications.length) {
		await LocalNotifications.cancel({
			notifications: pending.notifications.map((n) => ({ id: n.id }))
		});
	}
}
