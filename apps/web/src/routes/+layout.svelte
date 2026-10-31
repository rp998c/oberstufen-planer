<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const links = [
		{ href: '/', label: 'Übersicht' },
		{ href: '/noten', label: 'Noten' },
		{ href: '/abitur', label: 'Abitur' },
		{ href: '/kalender', label: 'Kalender' },
		{ href: '/prognose', label: 'Was wäre wenn' },
		{ href: '/mehr', label: 'Mehr' }
	];
	const MORE = [
		'/mehr',
		'/stundenplan',
		'/aufgaben',
		'/ziele',
		'/faecher',
		'/einstellungen',
		'/zusammenfassung'
	];
	const current = (href: string) =>
		href === '/'
			? page.url.pathname === '/'
			: href === '/mehr'
				? MORE.some((m) => page.url.pathname.startsWith(m))
				: page.url.pathname.startsWith(href);
</script>

<header>
	<a class="brand" href="/">Oberstufen-Planer</a>
	{#if data.authenticated && data.canLogout}
		<form
			method="POST"
			action="/logout"
			onsubmit={() => navigator.serviceWorker?.controller?.postMessage('clear-pages')}
		>
			<button class="link" type="submit">Abmelden</button>
		</form>
	{/if}
</header>

{#if data.authenticated}
	<nav class="main" aria-label="Hauptnavigation">
		{#each links as link (link.href)}
			<a href={link.href} aria-current={current(link.href) ? 'page' : undefined}>{link.label}</a>
		{/each}
	</nav>
{/if}

<main>
	{@render children()}
</main>

<footer>Planungshilfe – verbindlich ist die Berechnung der Schule.</footer>
