/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const ASSETS_CACHE = `assets-${version}`;
const PAGES_CACHE = 'pages';
const ASSETS = [...build, ...files];

/** Never cached: auth, API, feed, health check. */
const NO_CACHE = ['/login', '/logout', '/api/', '/kalender/feed/', '/healthz'];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(ASSETS_CACHE)
			.then((c) => c.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k !== ASSETS_CACHE && k !== PAGES_CACHE).map((k) => caches.delete(k))
				)
			)
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== sw.location.origin) return;
	if (NO_CACHE.some((p) => url.pathname.startsWith(p))) return;

	// build output and static files: cache first
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((r) => r ?? fetch(req)));
		return;
	}

	// the page: network first, fall back to the last copy (the data itself is kept in the browser)
	event.respondWith(
		(async () => {
			try {
				const res = await fetch(req);
				if (res.ok && res.type === 'basic' && !res.redirected) {
					const cache = await caches.open(PAGES_CACHE);
					await cache.put(req, res.clone());
				}
				return res;
			} catch (err) {
				const cached = await caches.match(req);
				if (cached) return cached;
				throw err;
			}
		})()
	);
});

sw.addEventListener('message', (event) => {
	// sent on logout: forget cached pages
	if (event.data === 'clear-pages') event.waitUntil(caches.delete(PAGES_CACHE));
});
