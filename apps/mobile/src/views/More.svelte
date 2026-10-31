<script lang="ts">
	import { app } from '../lib/app.svelte.ts';
	import {
		notificationPermission,
		requestNotificationPermission,
		rescheduleReminders
	} from '../lib/notifications.ts';
	import SyncLine from './SyncLine.svelte';

	let permission = $state<'granted' | 'denied' | 'prompt'>('prompt');
	let scheduled = $state<number | null>(null);
	$effect(() => {
		void notificationPermission().then((p) => (permission = p));
	});

	async function enableNotifications() {
		permission = (await requestNotificationPermission()) ? 'granted' : 'denied';
		if (permission === 'granted')
			scheduled = await rescheduleReminders($state.snapshot(app.snapshot.data.events));
	}

	async function logout() {
		const pending = app.queue.length;
		const warning = pending
			? `${pending} Änderung(en) sind noch nicht auf dem Server und gehen verloren. Trotzdem abmelden?`
			: 'Die App vom Server trennen? Die Daten auf dem Server bleiben erhalten.';
		if (confirm(warning)) await app.logout();
	}
</script>

<h1>Mehr</h1>

<section class="card stack">
	<h2>Abgleich</h2>
	<SyncLine />
	{#if app.message}<p class="small error">{app.message}</p>{/if}
	<p class="small muted">
		Server: {app.connection?.server}<br />Gerät: {app.connection?.device}
	</p>
</section>

<section class="card stack">
	<h2>Erinnerungen</h2>
	<p class="small muted">
		Erinnerungen an Termine zeigt das Handy selbst an – auch ohne Internet. Welche Termine erinnern,
		stellst du im Kalender ein.
	</p>
	{#if permission === 'granted'}
		<p class="small ok">
			Benachrichtigungen sind erlaubt.{scheduled !== null
				? ` ${scheduled} Erinnerung(en) geplant.`
				: ''}
		</p>
	{:else if permission === 'denied'}
		<p class="small error">
			Benachrichtigungen sind ausgeschaltet. Erlaube sie in den Android-Einstellungen für
			„Oberstufen-Planer“.
		</p>
	{:else}
		<button onclick={enableNotifications}>Benachrichtigungen erlauben</button>
	{/if}
</section>

<section class="card stack">
	<h2>Im Browser</h2>
	<p class="small muted">
		Fächer einrichten, Abitur-Prüfungen, Was-wäre-wenn, Stundenplan und Sicherungen gibt es in der
		Web-Version.
	</p>
	<a class="button" href={app.connection?.server} target="_blank" rel="noreferrer"
		>Web-Version öffnen</a
	>
</section>

<section class="card stack">
	<button class="danger" onclick={logout}>Vom Server trennen</button>
</section>

<style>
	.button {
		background: var(--accent);
		color: var(--accent-text);
		padding: 0.6rem 1rem;
		border-radius: 8px;
		text-decoration: none;
		font-weight: 600;
		text-align: center;
	}
</style>
