import { App as CapApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Network } from '@capacitor/network';
import { Share } from '@capacitor/share';
import { StatusBar, Style } from '@capacitor/status-bar';
import { handleBack, pickTextFile, router, store, type Platform } from '@oberstufen-planer/ui';
import {
	notificationPermission,
	requestNotificationPermission,
	rescheduleReminders
} from './notifications.ts';
import { load, remove, save } from './storage.ts';

/** Native part (MainActivity): switches the launcher icon between the two activity aliases. */
const AppIcon = registerPlugin<{ setIcon(o: { name: 'A' | 'C' }): Promise<void> }>('AppIcon');

/** Native part: app updates from the GitHub release (see UpdaterPlugin.java). */
const Updater = registerPlugin<{
	current(): Promise<{ code: number; name: string }>;
	latest(): Promise<{ code: number; name: string }>;
	install(): Promise<void>;
	addListener(
		event: 'progress',
		cb: (p: { percent: number }) => void
	): Promise<{ remove(): Promise<void> }>;
}>('Updater');

export const platform: Platform = {
	kind: 'android',
	sameOriginServer: false,
	canPrint: false,
	load,
	save,
	remove,
	async saveFile(name, mime, content) {
		// write to the app cache, then let the user choose where it goes (Drive, Downloads, mail …)
		const { uri } = await Filesystem.writeFile({
			path: name,
			data: content,
			directory: Directory.Cache,
			encoding: Encoding.UTF8
		});
		await Share.share({ title: name, url: uri, dialogTitle: 'Speichern oder teilen' }).catch(
			() => undefined
		);
		void mime;
	},
	pickFile: pickTextFile,
	async scheduleReminders(events) {
		// ask for the permission the first time there is something to remind of
		if (events.some((e) => e.reminders.length) && (await notificationPermission()) === 'prompt') {
			await requestNotificationPermission();
		}
		await rescheduleReminders(events);
	},
	notificationPermission,
	requestNotificationPermission,
	async setAppIcon(icon) {
		if (Capacitor.isNativePlatform()) await AppIcon.setIcon({ name: icon });
	},
	updates: Capacitor.isNativePlatform()
		? {
				current: () => Updater.current(),
				latest: () => Updater.latest(),
				async install(onProgress) {
					const sub = await Updater.addListener('progress', (p) => onProgress(p.percent));
					try {
						await Updater.install();
					} finally {
						await sub.remove();
					}
				}
			}
		: undefined,
	async setTheme(dark) {
		if (!Capacitor.isNativePlatform()) return;
		await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
		await StatusBar.setBackgroundColor({ color: dark ? '#0e0f11' : '#f6f6f7' }).catch(
			() => undefined
		);
	}
};

/** Back button, resume and network events. */
export function wireNative() {
	if (!Capacitor.isNativePlatform()) return;
	void CapApp.addListener('backButton', () => {
		if (handleBack()) return;
		if (!router.back()) void CapApp.minimizeApp();
	});
	void CapApp.addListener('resume', () => {
		void store.sync();
		void store.checkUpdate();
	});
	void Network.addListener('networkStatusChange', (s) => {
		if (s.connected) void store.sync();
	});
}
