<script lang="ts">
	import { onMount } from 'svelte';
	import {
		backupFile,
		buildIcal,
		migrateData,
		parseIcal,
		type CalEvent
	} from '@oberstufen-planer/app-core';
	import Icon from '../components/Icon.svelte';
	import Logo from '../components/Logo.svelte';
	import Sheet from '../components/Sheet.svelte';
	import { request } from '../lib/api.ts';
	import { href } from '../lib/router.svelte.ts';
	import { newId, store, type Prefs } from '../lib/store.svelte.ts';
	import { ui } from '../lib/ui.svelte.ts';

	const web = $derived(store.platform.sameOriginServer);
	const android = $derived(store.platform.kind === 'android');

	const modes: [Prefs['theme'], string][] = [
		['dark', 'Dunkel'],
		['light', 'Hell'],
		['system', 'Wie System']
	];
	const accents: [Prefs['accent'], string, string][] = [
		['blau', 'Blau', '#5B7BF0'],
		['violett', 'Violett', '#8B6CF0'],
		['petrol', 'Petrol', '#1AA0A6'],
		['orange', 'Orange', '#E8833A'],
		['rose', 'Rosé', '#E0607E']
	];

	async function setIcon(icon: 'A' | 'C') {
		store.savePrefs({ icon });
		await store.platform.setAppIcon?.(icon).catch(() => undefined);
	}

	// ---- app updates (Android) -------------------------------------------------------------
	let checking = $state(false);
	let updateMsg = $state('');
	async function checkUpdate() {
		checking = true;
		updateMsg = '';
		try {
			if (!(await store.checkUpdate(true))) ui.notify('Die App ist aktuell.');
		} catch (e) {
			updateMsg = e instanceof Error ? e.message : String(e);
		} finally {
			checking = false;
		}
	}
	async function installUpdate() {
		updateMsg = '';
		try {
			await store.installUpdate();
		} catch (e) {
			updateMsg = e instanceof Error ? e.message : String(e);
		}
	}

	// ---- Abitur year --------------------------------------------------------------------
	let abiYear = $state('');
	$effect(() => {
		abiYear = store.data.profile.abiYear ? String(store.data.profile.abiYear) : '';
	});
	function saveYear() {
		const n = Number(abiYear);
		if (abiYear === '' || (Number.isInteger(n) && n >= 2020 && n <= 2100)) {
			if ((n || null) !== store.data.profile.abiYear)
				store.mutate({ type: 'profile.set', abiYear: n || null });
		} else abiYear = store.data.profile.abiYear ? String(store.data.profile.abiYear) : '';
	}

	// ---- server things (feed, devices) --------------------------------------------------
	const conn = $derived(store.connection);
	let feedUrl = $state<string | null>(null);
	let devices = $state<
		{ id: string; name: string; kind: string; lastSeenAt: number | null; current: boolean }[]
	>([]);
	async function loadServerInfo() {
		if (!conn || store.status === 'unauthorized') return;
		try {
			const f = await request<{ path: string }>(conn.server, '/api/feed', { token: conn.token });
			feedUrl = (conn.server || location.origin) + f.path;
			if (web) devices = (await request<{ devices: typeof devices }>('', '/api/devices')).devices;
		} catch {
			feedUrl = null;
		}
	}
	onMount(() => void loadServerInfo());
	// try again once a running sync is through (e.g. right after connecting)
	$effect(() => {
		if (store.status === 'ok' && conn && feedUrl === null) void loadServerInfo();
	});
	async function newFeed() {
		if (!conn || !confirm('Neuen Link erstellen? Der alte funktioniert dann nicht mehr.')) return;
		const f = await request<{ path: string }>(conn.server, '/api/feed', {
			method: 'POST',
			token: conn.token
		});
		feedUrl = (conn.server || location.origin) + f.path;
		ui.notify('Neuer Link erstellt');
	}
	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			ui.notify('Kopiert');
		} catch {
			prompt('Zum Kopieren:', text);
		}
	}
	async function removeDevice(id: string) {
		if (!confirm('Dieses Gerät abmelden?')) return;
		await request('', `/api/devices?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
		devices = devices.filter((d) => d.id !== id);
	}

	// ---- calendar files -----------------------------------------------------------------
	async function importIcs() {
		const text = await store.platform.pickFile('.ics,text/calendar');
		if (!text) return;
		const parsed = parseIcal(text);
		if (!parsed.length) {
			ui.notify('Keine Termine in der Datei gefunden.');
			return;
		}
		const events: CalEvent[] = parsed.slice(0, 2000).map((e) => ({
			id: newId(),
			subjectId: null,
			title: e.title.trim() || 'Termin',
			kind: 'sonstiges',
			start: e.start,
			end: e.allDay ? e.end : null,
			allDay: e.allDay,
			note: e.note,
			reminders: [],
			externalUid: e.uid
		}));
		store.mutate({ type: 'events.import', events });
		ui.notify(`${events.length} Termine importiert`);
	}
	async function exportIcs() {
		await store.platform.saveFile(
			'oberstufen-planer.ics',
			'text/calendar',
			buildIcal(store.data.events)
		);
	}

	// ---- notifications (app) ------------------------------------------------------------
	let notif = $state<'granted' | 'denied' | 'prompt' | null>(null);
	onMount(async () => {
		notif = (await store.platform.notificationPermission?.()) ?? null;
	});
	async function askNotif() {
		const ok = await store.platform.requestNotificationPermission?.();
		notif = ok ? 'granted' : 'denied';
		if (ok) await store.platform.scheduleReminders?.(store.data.events);
	}

	// ---- connect (app) ------------------------------------------------------------------
	let connectOpen = $state(false);
	let server = $state('');
	let password = $state('');
	let device = $state('Handy');
	let connecting = $state(false);
	let connectError = $state('');
	async function connect(e: Event) {
		e.preventDefault();
		connecting = true;
		connectError = '';
		try {
			await store.connect(server, password, device);
			connectOpen = false;
			password = '';
			if (!store.conflict) ui.notify('Verbunden');
			void loadServerInfo();
		} catch (err) {
			connectError = err instanceof Error ? err.message : String(err);
		} finally {
			connecting = false;
		}
	}
	async function disconnect() {
		if (!confirm('Vom Server trennen? Deine Daten bleiben auf diesem Handy.')) return;
		await store.disconnect();
		feedUrl = null;
	}
	const lastSyncText = $derived(
		store.lastSync
			? new Date(store.lastSync).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
			: 'noch nie'
	);

	// ---- backup -------------------------------------------------------------------------
	async function backup() {
		const d = new Date().toISOString().slice(0, 10);
		await store.platform.saveFile(
			`oberstufen-planer-${d}.json`,
			'application/json',
			JSON.stringify(backupFile($state.snapshot(store.data)), null, 1)
		);
	}
	async function restore() {
		const text = await store.platform.pickFile('.json,application/json');
		if (!text) return;
		try {
			const data = migrateData(JSON.parse(text));
			if (
				!confirm(
					`Sicherung mit ${data.subjects.length} Fächern und ${data.grades.length} Noten wiederherstellen? Alles Aktuelle wird ersetzt.`
				)
			)
				return;
			store.replaceAll(data);
			ui.notify('Wiederhergestellt');
		} catch (e) {
			ui.notify(e instanceof Error ? e.message : 'Das ist keine gültige Sicherung.');
		}
	}

	// ---- password (web) -----------------------------------------------------------------
	let pwOpen = $state(false);
	let pwCurrent = $state('');
	let pwNew = $state('');
	let pwRepeat = $state('');
	let pwError = $state('');
	async function changePassword(e: Event) {
		e.preventDefault();
		pwError = '';
		if (pwNew.length < 8) return (pwError = 'Mindestens 8 Zeichen.');
		if (pwNew !== pwRepeat) return (pwError = 'Die Passwörter stimmen nicht überein.');
		try {
			await request('', '/api/password', {
				method: 'POST',
				body: { current: pwCurrent, next: pwNew }
			});
			pwOpen = false;
			pwCurrent = pwNew = pwRepeat = '';
			ui.notify('Passwort geändert');
		} catch (err) {
			pwError = err instanceof Error ? err.message : String(err);
		}
	}
</script>

<h1 class="title">Einstellungen</h1>

<div class="stack">
	<section class="card" aria-labelledby="look-h">
		<h2 id="look-h" class="card-title sh">Darstellung</h2>
		<div class="row">
			<span>Modus</span>
			<div class="seg" role="group" aria-label="Modus">
				{#each modes as [id, label] (id)}
					<button
						type="button"
						aria-pressed={store.prefs.theme === id}
						onclick={() => store.savePrefs({ theme: id })}>{label}</button
					>
				{/each}
			</div>
		</div>
		<div class="row">
			<span>Farbe</span>
			<div class="swatches" role="group" aria-label="Farbe">
				{#each accents as [id, label, color] (id)}
					<button
						type="button"
						class="sw"
						class:on={store.prefs.accent === id}
						style:background={color}
						aria-label={label}
						title={label}
						aria-pressed={store.prefs.accent === id}
						onclick={() => store.savePrefs({ accent: id })}
					></button>
				{/each}
			</div>
		</div>
		<div class="row">
			<span>App-Icon</span>
			<div class="icons" role="group" aria-label="App-Icon">
				{#each ['A', 'C'] as const as i (i)}
					<button
						type="button"
						class="ib"
						class:on={store.prefs.icon === i}
						aria-pressed={store.prefs.icon === i}
						aria-label="Icon {i}"
						onclick={() => setIcon(i)}><Logo size={46} icon={i} /></button
					>
				{/each}
			</div>
		</div>
	</section>

	<section class="card" aria-labelledby="abi-h">
		<h2 id="abi-h" class="card-title sh">Abitur</h2>
		<div class="row">
			<label for="abiYear">Abiturjahr</label>
			<input
				id="abiYear"
				class="input yr"
				inputmode="numeric"
				bind:value={abiYear}
				onblur={saveYear}
				onkeydown={(e) => e.key === 'Enter' && saveYear()}
			/>
		</div>
		<div class="row">
			<span>Fächer neu wählen <span class="muted">· mit Prüfung der Regeln</span></span><a
				class="btn"
				href={href({ name: 'setup' })}>Einrichtung öffnen</a
			>
		</div>
	</section>

	<section class="card" aria-labelledby="cal-h">
		<h2 id="cal-h" class="card-title sh">Kalender</h2>
		{#if feedUrl}
			<div class="row">
				<span
					>Kalender-Abo <span class="muted">· deine Termine in Google, Apple oder Outlook</span
					></span
				>
				<span class="btns"
					><button class="btn" type="button" onclick={() => copy(feedUrl!)}>Link kopieren</button
					><button class="btn" type="button" onclick={newFeed}>Neuer Link</button></span
				>
			</div>
		{:else}
			<div class="row">
				<span
					>Als Datei exportieren <span class="muted">· zum Importieren in andere Kalender</span
					></span
				>
				<button class="btn" type="button" onclick={exportIcs}>.ics speichern</button>
			</div>
		{/if}
		<div class="row">
			<span
				>Kalender importieren <span class="muted"
					>· .ics-Datei, z. B. Ferien oder Schulkalender</span
				></span
			>
			<button class="btn" type="button" onclick={importIcs}>Datei wählen</button>
		</div>
		{#if notif !== null}
			<div class="row">
				<span
					>Erinnerungen auf dem Handy <span class="muted"
						>· {notif === 'granted' ? 'aktiv' : 'nicht erlaubt'}</span
					></span
				>
				{#if notif !== 'granted'}<button class="btn" type="button" onclick={askNotif}
						>Erlauben</button
					>{/if}
			</div>
		{/if}
	</section>

	{#if android}
		<section class="card" aria-labelledby="sync-h">
			<h2 id="sync-h" class="card-title sh">Sync <span class="muted w500">· optional</span></h2>
			{#if conn}
				<div class="row">
					<span
						><strong class="w600">{conn.server.replace(/^https?:\/\//, '')}</strong>
						<span class="muted"
							>· zuletzt {lastSyncText}{store.status === 'offline' ? ' · gerade offline' : ''}</span
						></span
					>
					<span class="btns"
						><button class="btn" type="button" onclick={() => void store.sync()}>Jetzt</button
						><button class="btn" type="button" onclick={disconnect}>Trennen</button></span
					>
				</div>
				{#if store.message}<p class="row msg warn-text">{store.message}</p>{/if}
			{:else}
				<div class="row">
					<span class="muted"
						>Alles ist auf diesem Handy gespeichert. Mit einem eigenen Server (z. B. auf deinem NAS)
						hast du es auch im Browser.</span
					>
					<button class="btn" type="button" onclick={() => (connectOpen = true)}
						><Icon name="cloud" size={16} /> Verbinden</button
					>
				</div>
			{/if}
		</section>
	{/if}

	{#if store.platform.updates}
		<section class="card" aria-labelledby="upd-h">
			<h2 id="upd-h" class="card-title sh">App-Version</h2>
			<div class="row">
				<span
					>{store.appVersion?.name ?? '…'}
					<span class="muted"
						>· {store.updating !== null
							? `Update lädt ${store.updating >= 0 ? store.updating + ' %' : '…'}`
							: store.update
								? `Version ${store.update.name} verfügbar`
								: 'sucht automatisch nach Updates'}</span
					></span
				>
				{#if store.update}
					<button
						class="btn accent"
						type="button"
						disabled={store.updating !== null}
						onclick={installUpdate}>Installieren</button
					>
				{:else}
					<button class="btn" type="button" disabled={checking} onclick={checkUpdate}
						>Jetzt prüfen</button
					>
				{/if}
			</div>
			{#if updateMsg}<p class="row msg warn-text">{updateMsg}</p>{/if}
		</section>
	{/if}

	{#if web}
		<section class="card" aria-labelledby="dev-h">
			<h2 id="dev-h" class="card-title sh">
				Geräte &amp; Sync <span class="muted w500">· optional</span>
			</h2>
			{#each devices.filter((d) => d.kind === 'app') as d (d.id)}
				<div class="row">
					<span
						><strong class="w600">{d.name}</strong>
						<span class="muted"
							>· Android-App · zuletzt {d.lastSeenAt
								? new Date(d.lastSeenAt).toLocaleDateString('de-DE')
								: 'nie'}</span
						></span
					>
					<button class="btn" type="button" onclick={() => removeDevice(d.id)}>Abmelden</button>
				</div>
			{/each}
			<div class="row">
				<span class="muted"
					>Handy verbinden: in der App unter Einstellungen → Sync diese Adresse und dein Passwort
					eingeben.</span
				>
				<button class="btn" type="button" onclick={() => copy(location.origin)}
					>Adresse kopieren</button
				>
			</div>
		</section>
	{/if}

	{#if ui.wide}
		<section class="card" aria-labelledby="keys-h">
			<h2 id="keys-h" class="card-title sh">Tastenkürzel</h2>
			<div class="row"><span>Note eintragen</span><kbd>N</kbd></div>
			<div class="row">
				<span>Halbjahr wechseln (auf einer Fachseite)</span><span class="kbds"
					><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd></span
				>
			</div>
			<div class="row"><span>Seitenleiste ein- und ausklappen</span><kbd>[</kbd></div>
			<div class="row"><span>Fenster schließen</span><kbd>Esc</kbd></div>
		</section>
	{/if}

	<section class="card" aria-labelledby="data-h">
		<h2 id="data-h" class="card-title sh">Daten{web ? ' & Konto' : ''}</h2>
		<div class="row">
			<span>Komplette Sicherung <span class="muted">· alle Noten, Fächer, Termine</span></span>
			<span class="btns"
				><button class="btn" type="button" onclick={backup}>Sichern</button><button
					class="btn"
					type="button"
					onclick={restore}>Wiederherstellen</button
				></span
			>
		</div>
		{#if store.platform.canPrint}
			<div class="row">
				<span>Zusammenfassung zum Ausdrucken oder als PDF</span><a
					class="btn"
					href={href({ name: 'summary' })}>Öffnen</a
				>
			</div>
		{/if}
		{#if web}
			<div class="row">
				<span>Passwort</span><button class="btn" type="button" onclick={() => (pwOpen = true)}
					>Ändern</button
				>
			</div>
			<div class="row">
				<span>Abmelden <span class="muted">· in diesem Browser</span></span>
				<form method="POST" action="/logout">
					<button class="btn" type="submit">Abmelden</button>
				</form>
			</div>
		{/if}
	</section>
</div>

{#if connectOpen}
	<Sheet title="Mit Server verbinden" onclose={() => (connectOpen = false)}>
		<form class="form" onsubmit={connect}>
			<p class="muted small" style="margin: 0; line-height: 1.5">
				Adresse deines Oberstufen-Planer-Servers, z. B. <code>http://192.168.1.10:3000</code>.
				Danach sind Handy und Browser immer auf demselben Stand.
			</p>
			<label class="field"
				><span>Server-Adresse</span><input
					class="input"
					inputmode="url"
					autocapitalize="off"
					autocomplete="url"
					required
					bind:value={server}
					placeholder="http://192.168.1.10:3000"
				/></label
			>
			<label class="field"
				><span>Passwort</span><input
					class="input"
					type="password"
					autocomplete="current-password"
					required
					bind:value={password}
				/></label
			>
			<label class="field"
				><span>Name dieses Geräts</span><input
					class="input"
					maxlength="60"
					bind:value={device}
				/></label
			>
			{#if connectError}<p class="error-text" role="alert">{connectError}</p>{/if}
			<button class="btn accent big" type="submit" disabled={connecting}
				>{connecting ? 'Verbinde …' : 'Verbinden'}</button
			>
		</form>
	</Sheet>
{/if}

{#if pwOpen}
	<Sheet title="Passwort ändern" onclose={() => (pwOpen = false)} width={420}>
		<form class="form" onsubmit={changePassword}>
			<label class="field"
				><span>Aktuelles Passwort</span><input
					class="input"
					type="password"
					autocomplete="current-password"
					required
					bind:value={pwCurrent}
				/></label
			>
			<label class="field"
				><span>Neues Passwort</span><input
					class="input"
					type="password"
					autocomplete="new-password"
					minlength="8"
					required
					bind:value={pwNew}
				/></label
			>
			<label class="field"
				><span>Wiederholen</span><input
					class="input"
					type="password"
					autocomplete="new-password"
					required
					bind:value={pwRepeat}
				/></label
			>
			{#if pwError}<p class="error-text" role="alert">{pwError}</p>{/if}
			<button class="btn accent big" type="submit">Speichern</button>
		</form>
	</Sheet>
{/if}

<style>
	.title {
		margin-bottom: 20px;
	}
	.stack {
		max-width: 780px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.card {
		overflow: hidden;
	}
	.sh {
		padding: 16px 20px 12px;
	}
	.w500 {
		font-weight: 500;
		font-size: 13px;
	}
	.w600 {
		font-weight: 600;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 13px 20px;
		border-top: 1px solid var(--line);
		font-size: 14px;
		line-height: 1.4;
		margin: 0;
	}
	.btns {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.swatches,
	.icons {
		display: flex;
		gap: 10px;
	}
	.sw {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 0;
		cursor: pointer;
	}
	.sw.on,
	.ib.on {
		outline: 2px solid var(--text);
		outline-offset: 3px;
	}
	.ib {
		border: 0;
		padding: 0;
		background: none;
		border-radius: 13px;
		cursor: pointer;
	}
	.yr {
		width: 110px;
		text-align: center;
	}
	kbd {
		font-family: inherit;
		font-size: 12px;
		font-weight: 600;
		min-width: 24px;
		text-align: center;
		padding: 2px 7px;
		border-radius: 5px;
		border: 1px solid var(--border2);
		background: var(--surface2);
		color: var(--text2);
	}
	.kbds {
		display: flex;
		gap: 4px;
	}
	.msg {
		font-size: 13px;
	}
	.warn-text {
		color: var(--warn-text);
	}
	.form {
		display: grid;
		gap: 14px;
	}
	@media (max-width: 600px) {
		.row {
			flex-wrap: wrap;
		}
	}
</style>
