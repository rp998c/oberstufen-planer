import type { CalEvent } from '@oberstufen-planer/app-core';

/** What differs between the web version and the Android app. */
export interface Platform {
	kind: 'web' | 'android';
	/** Small key/value storage on this device. */
	load<T>(key: string, fallback: T): Promise<T>;
	save(key: string, value: unknown): Promise<void>;
	remove(key: string): Promise<void>;
	/**
	 * Web: the page is served by the server, so it is always connected (cookie login).
	 * Android: standalone, a server can be connected in the settings.
	 */
	sameOriginServer: boolean;
	/** Saves or shares a file the user can keep. */
	saveFile(name: string, mime: string, content: string): Promise<void>;
	/** Lets the user pick a text file; null if cancelled. */
	pickFile(accept: string): Promise<string | null>;
	/** Called after events changed, to schedule reminders on the device. */
	scheduleReminders?(events: CalEvent[]): Promise<void>;
	notificationPermission?(): Promise<'granted' | 'denied' | 'prompt'>;
	requestNotificationPermission?(): Promise<boolean>;
	/** Android: switches the launcher icon. */
	setAppIcon?(icon: 'A' | 'C'): Promise<void>;
	canPrint: boolean;
	/** Android: status bar colours for the current theme. */
	setTheme?(dark: boolean): Promise<void>;
	/** Android: app updates from the GitHub release. */
	updates?: Updates;
	/** Web: back to the login page after the session expired. */
	onUnauthorized?(): void;
}

export interface AppVersion {
	code: number;
	name: string;
}

export interface Updates {
	current(): Promise<AppVersion>;
	/** Version of the newest published APK. */
	latest(): Promise<AppVersion>;
	/** Downloads the newest APK and opens the Android installer. */
	install(onProgress: (percent: number) => void): Promise<void>;
}

/** Browser download / file picker (web). */
export function downloadFile(name: string, mime: string, content: string) {
	const url = URL.createObjectURL(new Blob([content], { type: mime }));
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickTextFile(accept: string): Promise<string | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.onchange = async () => {
			const f = input.files?.[0];
			resolve(f ? await f.text() : null);
		};
		input.addEventListener('cancel', () => resolve(null));
		input.click();
	});
}
