<script lang="ts">
	import { onMount } from 'svelte';
	import '@fontsource-variable/inter';
	import './theme.css';
	import Icon from './components/Icon.svelte';
	import Logo from './components/Logo.svelte';
	import Sheet from './components/Sheet.svelte';
	import GradeSheet from './components/GradeSheet.svelte';
	import type { Platform } from './lib/platform.ts';
	import { href, router, type Route } from './lib/router.svelte.ts';
	import { store } from './lib/store.svelte.ts';
	import { ui } from './lib/ui.svelte.ts';
	import Overview from './views/Overview.svelte';
	import SubjectPage from './views/Subject.svelte';
	import Abitur from './views/Abitur.svelte';
	import Calendar from './views/Calendar.svelte';
	import Subjects from './views/Subjects.svelte';
	import Settings from './views/Settings.svelte';
	import Setup from './views/Setup.svelte';
	import Summary from './views/Summary.svelte';
	import Start from './views/Start.svelte';

	let { platform }: { platform: Platform } = $props();

	onMount(() => {
		void store.init(platform);
		// changes from other devices: check when the tab/app comes back and once a minute
		const refresh = () => document.visibilityState === 'visible' && void store.sync();
		document.addEventListener('visibilitychange', refresh);
		window.addEventListener('focus', refresh);
		const timer = setInterval(refresh, 60_000);
		return () => {
			document.removeEventListener('visibilitychange', refresh);
			window.removeEventListener('focus', refresh);
			clearInterval(timer);
		};
	});

	const theme = $derived(
		store.prefs.theme === 'system' ? (ui.systemDark ? 'dark' : 'light') : store.prefs.theme
	);
	const themeClass = $derived(`${theme} acc-${store.prefs.accent}`);
	$effect(() => {
		document.documentElement.className = themeClass;
		void platform.setTheme?.(theme === 'dark');
	});

	const nav: { route: Route; label: string; icon: string }[] = [
		{ route: { name: 'overview' }, label: 'Übersicht', icon: 'home' },
		{ route: { name: 'abitur' }, label: 'Abitur', icon: 'abitur' },
		{ route: { name: 'calendar' }, label: 'Kalender', icon: 'calendar' },
		{ route: { name: 'subjects' }, label: 'Fächer', icon: 'list' }
	];
	const active = (r: Route) =>
		router.route.name === r.name || (r.name === 'overview' && router.route.name === 'subject');

	const hasSubjects = $derived(store.data.subjects.length > 0);
	const showStart = $derived(
		store.ready &&
			platform.kind === 'android' &&
			!store.prefs.started &&
			!store.connection &&
			!hasSubjects
	);
	const showSetup = $derived(
		store.ready && !hasSubjects && !showStart && router.route.name !== 'settings'
	);
	const collapsed = $derived(store.prefs.collapsed);

	let quickAdd = $state(false);

	const syncText = $derived(
		!store.connection
			? 'Nur auf diesem Gerät'
			: {
					local: 'Nur auf diesem Gerät',
					syncing: 'Synchronisiere …',
					ok: 'Synchronisiert',
					offline: 'Offline – wird später synchronisiert',
					unauthorized: 'Abgemeldet',
					error: 'Sync-Fehler'
				}[store.status]
	);
	const syncColor = $derived(
		store.status === 'ok' || !store.connection
			? 'var(--ok)'
			: store.status === 'syncing' || store.status === 'offline'
				? 'var(--warn-dot)'
				: 'var(--bad)'
	);

	function onKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		if (
			e.ctrlKey ||
			e.metaKey ||
			e.altKey ||
			/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) ||
			document.querySelector('[role=dialog]')
		)
			return;
		if (e.key === 'n' || e.key === 'N') {
			if (!hasSubjects) return;
			e.preventDefault();
			if (router.route.name === 'subject') ui.quickAdd++;
			else quickAdd = true;
		} else if (e.key === '[') {
			store.savePrefs({ collapsed: !collapsed });
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="op-root {themeClass}">
	{#if !store.ready}
		<div class="loading"><Logo size={48} icon={store.prefs.icon} /></div>
	{:else if showStart}
		<Start />
	{:else if showSetup || router.route.name === 'setup'}
		<Setup />
	{:else if router.route.name === 'summary'}
		<Summary />
	{:else}
		<div class="shell" class:wide={ui.wide} class:collapsed={collapsed && ui.wide}>
			{#if ui.wide}
				<nav class="side no-print" aria-label="Hauptnavigation">
					<div class="brand">
						<Logo icon={store.prefs.icon} />
						{#if !collapsed}<span>Oberstufen-Planer</span>{/if}
					</div>
					{#each nav as n (n.label)}
						<a
							class="navlink"
							href={href(n.route)}
							aria-current={active(n.route) ? 'page' : undefined}
							title={n.label}
						>
							<Icon name={n.icon} />{#if !collapsed}<span>{n.label}</span>{/if}
						</a>
					{/each}
					<div class="spacer"></div>
					<a
						class="navlink"
						href={href({ name: 'settings' })}
						aria-current={router.route.name === 'settings' ? 'page' : undefined}
						title="Einstellungen"
					>
						<Icon name="settings" />{#if !collapsed}<span>Einstellungen</span>{/if}
					</a>
					<button
						class="navlink"
						type="button"
						onclick={() => store.savePrefs({ collapsed: !collapsed })}
						title={collapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}
						aria-expanded={!collapsed}
					>
						<Icon name="sidebar" />{#if !collapsed}<span>Einklappen</span>{/if}
					</button>
					<div class="sync" title={syncText}>
						<span class="sdot" style:background={syncColor}></span>{#if !collapsed}<span
								>{syncText}</span
							>{/if}
					</div>
				</nav>
			{/if}

			<main class="main">
				{#if store.status === 'unauthorized' && !platform.sameOriginServer}
					<div class="banner warn top">
						<Icon name="alert" />
						<span
							>{store.message} <a href={href({ name: 'settings' })}>Zu den Einstellungen</a></span
						>
					</div>
				{/if}
				{#if router.route.name === 'overview'}<Overview onadd={() => (quickAdd = true)} />
				{:else if router.route.name === 'subject'}<SubjectPage
						id={router.route.id}
						halfYear={router.route.halfYear}
					/>
				{:else if router.route.name === 'abitur'}<Abitur />
				{:else if router.route.name === 'calendar'}<Calendar />
				{:else if router.route.name === 'subjects'}<Subjects />
				{:else if router.route.name === 'settings'}<Settings />{/if}
			</main>

			{#if !ui.wide}
				<nav class="tabs no-print" aria-label="Hauptnavigation">
					{#each nav as n (n.label)}
						<a href={href(n.route)} aria-current={active(n.route) ? 'page' : undefined}>
							<Icon name={n.icon} size={22} /><span>{n.label}</span>
						</a>
					{/each}
				</nav>
			{/if}
		</div>
	{/if}

	{#if quickAdd}<GradeSheet onclose={() => (quickAdd = false)} />{/if}

	{#if store.conflict}
		<Sheet title="Welche Daten behalten?" onclose={() => void store.resolveConflict('server')}>
			<p class="muted" style="margin: 0; line-height: 1.5">
				Auf dem Server und auf diesem Handy sind schon Fächer und Noten gespeichert. Welche sollen
				gelten? Die anderen werden ersetzt.
			</p>
			{#snippet footer()}
				<button class="btn" type="button" onclick={() => void store.resolveConflict('server')}
					>Vom Server</button
				>
				<button
					class="btn accent"
					type="button"
					onclick={() => void store.resolveConflict('device')}>Von diesem Handy</button
				>
			{/snippet}
		</Sheet>
	{/if}

	{#if ui.toast}<div class="toast" role="status">{ui.toast}</div>{/if}
</div>

<style>
	.loading {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.shell {
		min-height: 100dvh;
	}
	.shell.wide {
		display: flex;
	}
	.side {
		position: sticky;
		top: 0;
		height: 100dvh;
		flex: none;
		width: 240px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 20px 12px 16px;
		border-right: 1px solid var(--border);
		background: var(--side);
	}
	.collapsed .side {
		width: 68px;
		align-items: center;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 6px 22px;
		font-weight: 650;
		font-size: 15px;
		white-space: nowrap;
	}
	.navlink {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 9px 12px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--text2);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		text-align: left;
	}
	.collapsed .navlink {
		justify-content: center;
		padding: 10px;
	}
	.navlink:hover,
	.navlink[aria-current='page'] {
		background: var(--hover);
		color: var(--text);
	}
	button.navlink {
		color: var(--muted);
	}
	.spacer {
		flex: 1;
	}
	.sync {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px 0;
		font-size: 12px;
		color: var(--muted);
		white-space: nowrap;
	}
	.sdot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex: none;
	}
	.main {
		flex: 1;
		min-width: 0;
		padding: 28px 40px 48px;
	}
	.shell:not(.wide) .main {
		padding: calc(20px + env(safe-area-inset-top)) 16px calc(96px + env(safe-area-inset-bottom));
	}
	.top {
		margin-bottom: 16px;
	}
	.tabs {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 20;
		display: flex;
		padding: 0 8px env(safe-area-inset-bottom);
		background: var(--surface);
		border-top: 1px solid var(--border);
	}
	.tabs a {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 9px 0 10px;
		font-size: 11px;
		font-weight: 550;
		color: var(--muted);
	}
	.tabs a[aria-current='page'] {
		color: var(--text);
	}
	.toast {
		position: fixed;
		left: 50%;
		bottom: calc(90px + env(safe-area-inset-bottom));
		transform: translateX(-50%);
		z-index: 60;
		background: var(--strong);
		color: var(--on-strong);
		padding: 10px 16px;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 550;
		box-shadow: 0 8px 24px var(--shadow);
		max-width: calc(100% - 32px);
	}
	@media print {
		.main {
			padding: 0 !important;
		}
	}
</style>
