<script lang="ts">
	import { app } from '../lib/app.svelte.ts';

	let server = $state('');
	let password = $state('');
	let device = $state('Mein Handy');
	let busy = $state(false);
	let error = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		error = '';
		try {
			await app.connect(server, password, device);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			busy = false;
		}
	}
</script>

<h1>Oberstufen-Planer</h1>
<p class="muted">
	Verbinde die App mit deinem Server. Deine Daten werden danach auf dem Handy gespeichert und
	funktionieren auch offline.
</p>

<form class="card stack" onsubmit={submit}>
	<div class="field">
		<label for="server">Adresse des Servers</label>
		<input
			id="server"
			bind:value={server}
			required
			inputmode="url"
			autocapitalize="off"
			autocomplete="url"
			placeholder="z. B. 192.168.1.10:3000"
		/>
		<small class="muted">Dieselbe Adresse, die du im Browser öffnest.</small>
	</div>
	<div class="field">
		<label for="password">Passwort</label>
		<input
			id="password"
			type="password"
			bind:value={password}
			required
			autocomplete="current-password"
		/>
	</div>
	<div class="field">
		<label for="device">Name dieses Geräts</label>
		<input id="device" bind:value={device} maxlength="60" />
		<small class="muted"
			>Erscheint in den Einstellungen, damit du das Gerät dort abmelden kannst.</small
		>
	</div>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<button type="submit" disabled={busy}>{busy ? 'Verbinde …' : 'Verbinden'}</button>
</form>
