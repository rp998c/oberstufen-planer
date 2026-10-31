export type Tab = 'overview' | 'grades' | 'calendar' | 'tasks' | 'more';

/** Tab navigation plus a stack of "back" handlers for detail views (Android back button). */
class Nav {
	tab = $state<Tab>('overview');
	#backHandlers: (() => void)[] = [];

	go(tab: Tab) {
		this.#backHandlers = [];
		this.tab = tab;
		window.scrollTo(0, 0);
	}

	/** A detail view registers how to close itself; returns the unregister function. */
	onBack(handler: () => void) {
		this.#backHandlers.push(handler);
		return () => {
			this.#backHandlers = this.#backHandlers.filter((h) => h !== handler);
		};
	}

	/** Returns false if there was nothing to go back to. */
	back(): boolean {
		const handler = this.#backHandlers.pop();
		if (handler) {
			handler();
			return true;
		}
		if (this.tab !== 'overview') {
			this.tab = 'overview';
			return true;
		}
		return false;
	}
}

export const nav = new Nav();
