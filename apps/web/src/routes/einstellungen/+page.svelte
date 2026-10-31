<script lang="ts">
	import { enhance } from '$app/forms';
	import { REMINDER_PRESETS } from '$lib/calendar.ts';
	import PushToggle from '$lib/components/PushToggle.svelte';
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
	<h2>Notenarten und Gewichtung</h2>
	<p class="muted">
		Aus den Noten eines Halbjahrs wird pro Art der Durchschnitt gebildet und dann nach dem Gewicht
		verrechnet. Beispiel: Klausur 2, Mündlich 1 → Klausuren zählen doppelt. Frag am besten deine
		Lehrkräfte, wie sie gewichten.
	</p>
	<ul class="types">
		{#each data.gradeTypes as t (t.id)}
			<li>
				<form method="POST" action="?/saveType" use:enhance class="actions">
					<input type="hidden" name="id" value={t.id} />
					<input
						name="name"
						value={t.name}
						required
						maxlength="40"
						aria-label="Name"
						class="name"
					/>
					<input
						name="weight"
						type="number"
						min="0"
						max="10"
						step="0.5"
						value={t.weight}
						aria-label="Gewicht"
						class="narrow"
					/>
					<button type="submit" class="secondary">Speichern</button>
				</form>
				{#if !t.used}
					<form method="POST" action="?/deleteType" use:enhance>
						<input type="hidden" name="id" value={t.id} />
						<button type="submit" class="link">Löschen</button>
					</form>
				{/if}
			</li>
		{/each}
		<li>
			<form
				method="POST"
				action="?/saveType"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: true })}
				class="actions"
			>
				<input
					name="name"
					placeholder="Neue Notenart"
					required
					maxlength="40"
					aria-label="Name"
					class="name"
				/>
				<input
					name="weight"
					type="number"
					min="0"
					max="10"
					step="0.5"
					value="1"
					aria-label="Gewicht"
					class="narrow"
				/>
				<button type="submit">Hinzufügen</button>
			</form>
		</li>
	</ul>
</section>

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
	.types li > form:first-child {
		flex: 1;
	}
	.types form {
		margin: 0;
	}
</style>
