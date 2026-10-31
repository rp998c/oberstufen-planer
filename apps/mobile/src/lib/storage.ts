import { Preferences } from '@capacitor/preferences';

/** JSON values in the app's private storage (SharedPreferences on Android). */
export async function load<T>(key: string, fallback: T): Promise<T> {
	const { value } = await Preferences.get({ key });
	if (value === null) return fallback;
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

export async function save(key: string, value: unknown): Promise<void> {
	await Preferences.set({ key, value: JSON.stringify(value) });
}

export async function clearAll(): Promise<void> {
	await Preferences.clear();
}
