<script lang="ts">
	import { App as CapApp } from '@capacitor/app';
	import { Network } from '@capacitor/network';
	import { onMount } from 'svelte';
	import { app } from './lib/app.svelte.ts';
	import { nav } from './lib/nav.svelte.ts';
	import Connect from './views/Connect.svelte';
	import Overview from './views/Overview.svelte';
	import Grades from './views/Grades.svelte';
	import Calendar from './views/Calendar.svelte';
	import Tasks from './views/Tasks.svelte';
	import More from './views/More.svelte';

	const tabs = [
		{ id: 'overview', label: 'Übersicht', ico: '◎' },
		{ id: 'grades', label: 'Noten', ico: '✎' },
		{ id: 'calendar', label: 'Kalender', ico: '▦' },
		{ id: 'tasks', label: 'Aufgaben', ico: '✓' },
		{ id: 'more', label: 'Mehr', ico: '☰' }
	] as const;

	onMount(() => {
		void app.init();
		const subs = [
			CapApp.addListener('resume', () => void app.sync()),
			CapApp.addListener('backButton', () => {
				if (!nav.back()) void CapApp.minimizeApp();
			}),
			Network.addListener('networkStatusChange', (s) => {
				if (s.connected) void app.sync();
			})
		];
		// keep up to date while the app is open
		const timer = setInterval(() => void app.sync(), 5 * 60_000);
		return () => {
			clearInterval(timer);
			subs.forEach((p) => p.then((h) => h.remove()));
		};
	});
</script>

{#if !app.ready}
	<main class="app"><p class="muted">Lade …</p></main>
{:else if !app.connection}
	<main class="app"><Connect /></main>
{:else}
	<main class="app">
		{#if app.status === 'unauthorized'}
			<p class="banner">
				{app.message}
				<button class="link" onclick={() => nav.go('more')}>Zu den Einstellungen</button>
			</p>
		{/if}
		{#if nav.tab === 'overview'}<Overview />
		{:else if nav.tab === 'grades'}<Grades />
		{:else if nav.tab === 'calendar'}<Calendar />
		{:else if nav.tab === 'tasks'}<Tasks />
		{:else}<More />{/if}
	</main>
	<nav class="tabs" aria-label="Hauptnavigation">
		{#each tabs as t (t.id)}
			<button
				class:on={nav.tab === t.id}
				aria-current={nav.tab === t.id ? 'page' : undefined}
				onclick={() => nav.go(t.id)}
			>
				<span class="ico" aria-hidden="true">{t.ico}</span>{t.label}
			</button>
		{/each}
	</nav>
{/if}
