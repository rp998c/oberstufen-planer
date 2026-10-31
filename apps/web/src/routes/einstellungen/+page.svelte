<script lang="ts">
	import { enhance } from '$app/forms';
	import { REMINDER_PRESETS } from '$lib/calendar.ts';
	import PushToggle from '$lib/components/PushToggle.svelte';
	import WeightsInput from '$lib/components/WeightsInput.svelte';
	import { AREAS, AREA_LABELS } from '@oberstufen-planer/abi-engine-bw';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Einstellungen · Oberstufen-Planer</title></svelte:head>

<h1>Einstellungen</h1>

{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

<section class="card">
	<h2>Profil</h2>
	<form method="POST" action="?/profile" use:enhance class="actions">
		<label for="abiYear">Abiturjahr</label>
		<input
			id="abiYear"
			name="abiYear"
			type="number"
			min="2020"
			max="2100"
			value={data.profile.abiYear ?? ''}
			class="narrow"
		/>
		<button type="submit">Speichern</button>
		{#if form?.saved === 'profile'}<span class="muted">Gespeichert</span>{/if}
	</form>
</section>

<section class="card">
	<h2>Gewichtung</h2>
	<p class="muted">
		Die Halbjahresnote setzt sich aus Bereichen zusammen: schriftlich (Klausuren, Tests, GFS),
		mündlich und – z. B. in Sport oder BK – praktisch. Hier stellst du die Standard-Gewichtung ein;
		abweichende Fächer bekommen unter <a href="/faecher">Fächer</a> ihre eigene.
	</p>
	<form
		method="POST"
		action="?/defaultWeights"
		use:enhance={() =>
			async ({ update }) =>
				update({ reset: false })}
		class="stack"
	>
		<WeightsInput value={data.areaWeights} />
		<div class="actions">
			<button type="submit" class="secondary">Standard speichern</button>
			{#if form?.saved === 'weights'}<span class="ok">Gespeichert</span>{/if}
		</div>
	</form>
</section>

<section class="card">
	<h2>Notenarten</h2>
	<p class="muted">
		Jede Notenart gehört zu einem Bereich. Bei <strong>Tests</strong> wird der Schnitt aller Tests eines
		Halbjahrs gebildet; er zählt dann wie eine Klausur (oder wie viele du einstellst).
	</p>
	<ul class="types">
		{#each data.gradeTypes as t (t.id)}
			<li>{@render typeForm(t)}</li>
		{/each}
		<li>{@render typeForm()}</li>
	</ul>
</section>

{#snippet typeForm(t?: PageData['gradeTypes'][number])}
	<form
		method="POST"
		action="?/saveType"
		use:enhance={() =>
			async ({ update }) =>
				update({ reset: !t })}
		class="type"
	>
		<input type="hidden" name="id" value={t?.id ?? ''} />
		<input
			name="name"
			value={t?.name ?? ''}
			placeholder="Neue Notenart"
			required
			maxlength="40"
			aria-label="Name"
			class="name"
		/>
		<select name="area" aria-label="Bereich" value={t?.area ?? 'schriftlich'}>
			{#each AREAS as a (a)}<option value={a}>{AREA_LABELS[a]}</option>{/each}
		</select>
		<label class="inline test">
			<input type="checkbox" name="isTest" checked={t ? t.groupAs !== null : false} />
			Test: alle zusammen zählen wie
			<input
				name="groupAs"
				type="number"
				min="0.5"
				max="10"
				step="0.5"
				value={t?.groupAs ?? 1}
				aria-label="Anzahl Klausuren"
				class="tiny"
			/>
			Note(n)
		</label>
		<span class="actions">
			<button type="submit" class={t ? 'secondary' : ''}>{t ? 'Speichern' : 'Hinzufügen'}</button>
			{#if t && !t.used}
				<button type="submit" formaction="?/deleteType" class="link">Löschen</button>
			{/if}
		</span>
	</form>
{/snippet}

<section class="card">
	<h2>Erinnerungen</h2>
	<p class="muted">
		Erinnerungen an Klausuren und Termine kommen als Push-Benachrichtigung auf deine Geräte und/oder
		über <a href="https://ntfy.sh" rel="noreferrer" target="_blank">ntfy</a>.
		{data.pushDevices === 1 ? '1 Gerät' : `${data.pushDevices} Geräte`} für Push angemeldet.
	</p>
	<PushToggle />

	<form method="POST" action="?/ntfy" use:enhance class="stack ntfy">
		<div class="grid2">
			<div class="field">
				<label for="ntfy-server">ntfy-Server</label>
				<input id="ntfy-server" name="server" value={data.ntfy?.server ?? 'https://ntfy.sh'} />
			</div>
			<div class="field">
				<label for="ntfy-topic">Thema (leer = aus)</label>
				<input
					id="ntfy-topic"
					name="topic"
					value={data.ntfy?.topic ?? ''}
					placeholder="z. B. abi-x7k2q9"
				/>
			</div>
			<div class="field">
				<label for="ntfy-token">Zugangstoken (optional)</label>
				<input
					id="ntfy-token"
					name="token"
					type="password"
					autocomplete="off"
					value={data.ntfy?.token ?? ''}
				/>
			</div>
		</div>
		<p class="muted small">
			Auf ntfy.sh kann jeder ein Thema abonnieren, der seinen Namen kennt – wähle einen schwer zu
			erratenden Namen.
		</p>
		<div class="actions">
			<button type="submit" class="secondary">ntfy speichern</button>
			{#if form?.saved === 'ntfy'}<span class="muted">Gespeichert</span>{/if}
		</div>
	</form>

	<form method="POST" action="?/reminders" use:enhance class="stack">
		<fieldset>
			<legend>Standard-Erinnerungen für neue Termine</legend>
			{#each REMINDER_PRESETS as r (r.minutes)}
				<label class="inline"
					><input
						type="checkbox"
						name="reminders"
						value={r.minutes}
						checked={data.reminderDefaults.includes(r.minutes)}
					/>
					{r.label}</label
				>
			{/each}
		</fieldset>
		<div class="actions">
			<button type="submit" class="secondary">Speichern</button>
			{#if form?.saved === 'reminders'}<span class="muted">Gespeichert</span>{/if}
		</div>
	</form>

	<form method="POST" action="?/test" use:enhance class="actions">
		<button type="submit" class="secondary">Test-Benachrichtigung senden</button>
		{#if form?.saved === 'test'}<span class="muted">Gesendet</span>{/if}
	</form>
</section>

<section class="card">
	<h2>Kalender abonnieren</h2>
	<p class="muted">
		Mit dieser Adresse kannst du deine Termine im Kalender deines Handys abonnieren (iCal). Wer die
		Adresse kennt, sieht deine Termine – also nicht weitergeben.
	</p>
	<input
		readonly
		value={data.feedUrl}
		aria-label="Kalender-Adresse"
		onfocus={(e) => e.currentTarget.select()}
	/>
	<form method="POST" action="?/feed" use:enhance class="actions feed">
		<a href={data.feedUrl.replace(/^https?:/, 'webcal:')}>Im Kalender öffnen</a>
		<button type="submit" class="link">Neue Adresse erzeugen</button>
		{#if form?.saved === 'feed'}<span class="muted"
				>Neue Adresse erzeugt – alte gilt nicht mehr.</span
			>{/if}
	</form>
</section>

{#if data.password === 'app'}
	<section class="card">
		<h2>Passwort ändern</h2>
		<form
			method="POST"
			action="?/password"
			use:enhance={() =>
				async ({ update }) =>
					update({ reset: true })}
			class="stack"
		>
			<div class="grid2">
				<div class="field">
					<label for="pw-current">Aktuelles Passwort</label>
					<input
						id="pw-current"
						name="current"
						type="password"
						autocomplete="current-password"
						required
					/>
				</div>
				<div class="field">
					<label for="pw-next">Neues Passwort</label>
					<input
						id="pw-next"
						name="next"
						type="password"
						autocomplete="new-password"
						minlength="8"
						required
					/>
				</div>
				<div class="field">
					<label for="pw-repeat">Neues Passwort wiederholen</label>
					<input
						id="pw-repeat"
						name="repeat"
						type="password"
						autocomplete="new-password"
						minlength="8"
						required
					/>
				</div>
			</div>
			<p class="muted small">Andere angemeldete Geräte werden dabei abgemeldet.</p>
			<div class="actions">
				<button type="submit" class="secondary">Passwort ändern</button>
				{#if form?.saved === 'password'}<span class="ok">Passwort geändert.</span>{/if}
			</div>
		</form>
	</section>
{/if}

<section class="card">
	<h2>Android-App</h2>
	<p class="muted">
		In der App die Adresse dieses Servers eingeben und mit deinem Passwort anmelden. Die App
		speichert die Daten auf dem Handy, funktioniert offline und gleicht sich automatisch ab.
	</p>
	{#if data.appDevices.length}
		<ul class="devices">
			{#each data.appDevices as d (d.id)}
				<li>
					<span>
						<strong>{d.name}</strong>
						<small class="muted">
							angemeldet {new Date(d.createdAt).toLocaleDateString('de-DE')}{d.lastSeenAt
								? ` · zuletzt aktiv ${new Date(d.lastSeenAt).toLocaleDateString('de-DE')}`
								: ''}
						</small>
					</span>
					<form method="POST" action="?/revokeDevice" use:enhance>
						<input type="hidden" name="id" value={d.id} />
						<button type="submit" class="link">Abmelden</button>
					</form>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted small">Noch kein Gerät angemeldet.</p>
	{/if}
</section>

<section class="card">
	<h2>Daten</h2>
	<p class="muted">
		Sichere alle Fächer, Noten, Termine und Einstellungen als Datei – z. B. bevor du den Server
		umziehst. Beim Einspielen werden die aktuellen Daten vollständig ersetzt.
	</p>
	<div class="actions">
		<a class="button" href="/api/export" download>Sicherung herunterladen</a>
		<a href="/zusammenfassung">Zusammenfassung drucken / als PDF</a>
	</div>
	<form
		method="POST"
		action="?/restore"
		enctype="multipart/form-data"
		use:enhance
		class="actions restore"
		onsubmit={(e) => {
			if (!confirm('Alle aktuellen Daten durch die Sicherung ersetzen?')) e.preventDefault();
		}}
	>
		<input name="file" type="file" accept="application/json,.json" aria-label="Sicherungsdatei" />
		<button type="submit" class="secondary">Sicherung einspielen</button>
		{#if form?.saved === 'restore'}<span class="ok">Sicherung eingespielt.</span>{/if}
	</form>
</section>

<style>
	.button {
		background: var(--accent);
		color: var(--accent-text);
		padding: 0.55rem 0.9rem;
		border-radius: 8px;
		text-decoration: none;
		font-weight: 600;
	}
	.restore {
		margin-top: 1rem;
	}
	.devices {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.devices li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--border);
	}
	.devices li:last-child {
		border-bottom: 0;
	}
	.devices small {
		display: block;
	}
	.devices form {
		margin: 0;
	}
	.restore input {
		flex: 1 1 12rem;
		min-width: 0;
		max-width: 100%;
	}
	.ok {
		color: var(--accent);
	}
	.small {
		font-size: 0.85rem;
	}
	.ntfy,
	.feed {
		margin-top: 1rem;
	}
	fieldset {
		border: 1px solid var(--border);
		border-radius: 8px;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		margin-top: 1rem;
	}
	legend {
		font-weight: 600;
		padding: 0 0.3rem;
	}
	.inline {
		font-weight: 400;
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}
	.inline input {
		width: auto;
	}
	h2 {
		font-size: 1.05rem;
		margin-top: 0;
	}
	section {
		margin-top: 1rem;
	}
	.narrow {
		max-width: 6.5rem;
	}
	.name {
		flex: 1 1 10rem;
		width: auto;
	}
	.types {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	.types li {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.type {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.6rem;
		align-items: center;
		width: 100%;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border);
	}
	.type select {
		flex: 0 1 9rem;
	}
	.test {
		font-size: 0.85rem;
		flex-wrap: wrap;
	}
	.tiny {
		width: 4rem;
	}
	.types form {
		margin: 0;
	}
</style>
