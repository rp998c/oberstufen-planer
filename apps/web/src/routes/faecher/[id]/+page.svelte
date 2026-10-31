<script lang="ts">
	import { enhance } from '$app/forms';
	import { CATEGORY_LABELS } from '@oberstufen-planer/abi-engine-bw';
	import { HALF_YEAR_LABELS } from '$lib/subjects.ts';
	import WeightsInput from '$lib/components/WeightsInput.svelte';
	import { formatAreaWeights } from '@oberstufen-planer/abi-engine-bw';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Local editable copy of the loaded subject
	// svelte-ignore state_referenced_locally
	let level = $state(data.subject.level);
	// svelte-ignore state_referenced_locally
	let category = $state(data.subject.category);
	// svelte-ignore state_referenced_locally
	let customWeights = $state(data.subject.areaWeights !== null);
</script>

<svelte:head
	><title>{data.isNew ? 'Neues Fach' : data.subject.name} · Oberstufen-Planer</title></svelte:head
>

<p><a href="/faecher">← Fächer</a></p>
<h1>{data.isNew ? 'Neues Fach' : data.subject.name}</h1>

<form method="POST" action="?/save" use:enhance class="card stack">
	<div class="grid2">
		<div class="field">
			<label for="name">Name</label>
			<input id="name" name="name" required maxlength="60" value={data.subject.name} />
		</div>
		<div class="field">
			<label for="category">Kategorie</label>
			<select id="category" name="category" bind:value={category}>
				{#each Object.entries(CATEGORY_LABELS) as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
		</div>
	</div>

	<fieldset>
		<legend>Niveau</legend>
		<label class="inline"
			><input type="radio" name="level" value="BF" bind:group={level} /> Basisfach</label
		>
		<label class="inline"
			><input type="radio" name="level" value="LF" bind:group={level} /> Leistungsfach (schriftliche Prüfung)</label
		>
	</fieldset>

	{#if level === 'BF'}
		<label class="inline"
			><input type="checkbox" name="oral" checked={data.subject.exam === 'oral'} /> Mündliches Prüfungsfach</label
		>
	{/if}

	{#if category === 'fremdsprache' || category === 'nwt'}
		<label class="inline"
			><input type="checkbox" name="fromClass8" checked={data.subject.fromClass8} /> Begonnen in Klasse
			8 oder früher</label
		>
	{:else}
		<input type="hidden" name="fromClass8" value="on" />
	{/if}

	<fieldset>
		<legend>Belegte Halbjahre</legend>
		{#each [1, 2, 3, 4] as const as h (h)}
			<label class="inline"
				><input
					type="checkbox"
					name="halfYears"
					value={h}
					checked={data.subject.halfYears.includes(h)}
				/>
				{HALF_YEAR_LABELS[h]}</label
			>
		{/each}
	</fieldset>

	<fieldset class="weighting">
		<legend>Gewichtung der Halbjahresnote</legend>
		<label class="inline"
			><input
				type="radio"
				name="customWeights"
				value=""
				checked={!customWeights}
				onchange={() => (customWeights = false)}
			/>
			Standard ({formatAreaWeights(data.defaultWeights)})</label
		>
		<label class="inline"
			><input
				type="radio"
				name="customWeights"
				value="on"
				checked={customWeights}
				onchange={() => (customWeights = true)}
			/>
			Eigene Gewichtung für dieses Fach</label
		>
		{#if customWeights}
			<WeightsInput value={data.subject.areaWeights ?? data.defaultWeights} />
		{/if}
	</fieldset>

	<div class="field">
		<label for="color">Farbe</label>
		<input id="color" name="color" type="color" value={data.subject.color} class="color" />
	</div>

	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	<div class="actions">
		<button type="submit">Speichern</button>
	</div>
</form>

{#if !data.isNew}
	<form
		method="POST"
		action="?/delete"
		class="delete"
		onsubmit={(e) => {
			if (!confirm(`„${data.subject.name}“ mit ${data.gradeCount} Noten wirklich löschen?`))
				e.preventDefault();
		}}
	>
		<button type="submit" class="danger">Fach löschen</button>
	</form>
{/if}

<style>
	fieldset {
		border: 1px solid var(--border);
		border-radius: 8px;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.25rem;
	}
	legend {
		font-weight: 600;
		padding: 0 0.3rem;
	}
	.inline {
		font-weight: 400;
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.inline input {
		width: auto;
	}
	.weighting {
		display: grid;
	}
	.color {
		width: 4rem;
		height: 2.4rem;
		padding: 0.15rem;
	}
	.delete {
		margin-top: 1.5rem;
	}
</style>
