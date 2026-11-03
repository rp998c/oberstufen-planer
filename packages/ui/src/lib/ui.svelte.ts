/** Screen size and the open sheet (bottom sheet on phones, dialog on desktop). */
class Ui {
	wide = $state(
		typeof window !== 'undefined' ? window.matchMedia('(min-width: 900px)').matches : true
	);
	systemDark = $state(
		typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true
	);
	toast = $state<string | null>(null);
	#toastTimer: ReturnType<typeof setTimeout> | undefined;
	/** Incremented to ask the current page to open "Note eintragen". */
	quickAdd = $state(0);

	constructor() {
		if (typeof window === 'undefined') return;
		window
			.matchMedia('(min-width: 900px)')
			.addEventListener('change', (e) => (this.wide = e.matches));
		window
			.matchMedia('(prefers-color-scheme: dark)')
			.addEventListener('change', (e) => (this.systemDark = e.matches));
	}

	notify(message: string) {
		this.toast = message;
		clearTimeout(this.#toastTimer);
		this.#toastTimer = setTimeout(() => (this.toast = null), 3500);
	}
}

export const ui = new Ui();

/** Handlers for the Android back button (open sheets close first). */
const backHandlers: (() => void)[] = [];
export function onBack(fn: () => void): () => void {
	backHandlers.push(fn);
	return () => {
		const i = backHandlers.lastIndexOf(fn);
		if (i >= 0) backHandlers.splice(i, 1);
	};
}
export function handleBack(): boolean {
	const fn = backHandlers.at(-1);
	if (!fn) return false;
	fn();
	return true;
}
