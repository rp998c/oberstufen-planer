/** Hash routes, so the same code works in the browser and in the app (no server routes needed). */
export type Route =
	| { name: 'overview' }
	| { name: 'subject'; id: string; halfYear: number | null }
	| { name: 'abitur' }
	| { name: 'calendar' }
	| { name: 'subjects' }
	| { name: 'settings' }
	| { name: 'setup' }
	| { name: 'summary' };

function parse(hash: string): Route {
	const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
	switch (parts[0]) {
		case 'fach':
			return parts[1]
				? { name: 'subject', id: parts[1], halfYear: parts[2] ? Number(parts[2]) : null }
				: { name: 'subjects' };
		case 'abitur':
			return { name: 'abitur' };
		case 'kalender':
			return { name: 'calendar' };
		case 'faecher':
			return { name: 'subjects' };
		case 'einstellungen':
			return { name: 'settings' };
		case 'einrichtung':
			return { name: 'setup' };
		case 'zusammenfassung':
			return { name: 'summary' };
		default:
			return { name: 'overview' };
	}
}

export function href(route: Route): string {
	switch (route.name) {
		case 'overview':
			return '#/';
		case 'subject':
			return `#/fach/${encodeURIComponent(route.id)}${route.halfYear ? `/${route.halfYear}` : ''}`;
		case 'abitur':
			return '#/abitur';
		case 'calendar':
			return '#/kalender';
		case 'subjects':
			return '#/faecher';
		case 'settings':
			return '#/einstellungen';
		case 'setup':
			return '#/einrichtung';
		case 'summary':
			return '#/zusammenfassung';
	}
}

class Router {
	route = $state<Route>(
		typeof location !== 'undefined' ? parse(location.hash) : { name: 'overview' }
	);

	constructor() {
		if (typeof window !== 'undefined') {
			window.addEventListener('hashchange', () => {
				this.route = parse(location.hash);
				window.scrollTo(0, 0);
			});
		}
	}

	go(route: Route, replace = false) {
		const h = href(route);
		if (replace) history.replaceState(null, '', h);
		else if (location.hash !== h) location.hash = h;
		this.route = parse(h);
	}

	/** Android back button: true if there was somewhere to go back to. */
	back(): boolean {
		if (this.route.name === 'overview') return false;
		history.back();
		return true;
	}
}

export const router = new Router();
