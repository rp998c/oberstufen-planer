<script lang="ts">
	import { enhance } from '$app/forms';
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

<style>
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
