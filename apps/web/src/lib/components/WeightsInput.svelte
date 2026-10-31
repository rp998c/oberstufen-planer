<script lang="ts">
	import {
		AREAS,
		AREA_LABELS,
		formatAreaWeights,
		parsePercent,
		type AreaWeights
	} from '@oberstufen-planer/abi-engine-bw';

	/** Inputs named w_schriftlich, w_muendlich, w_praktisch (percent or fraction like "1/3"). */
	let { value, disabled = false }: { value: AreaWeights; disabled?: boolean } = $props();

	const fmt = (n: number) => {
		const third =
			Math.abs(n - 100 / 3) < 0.01 ? '1/3' : Math.abs(n - 200 / 3) < 0.01 ? '2/3' : null;
		return third ?? String(Math.round(n * 100) / 100).replace('.', ',');
	};

	// svelte-ignore state_referenced_locally
	let fields = $state<Record<string, string>>(
		Object.fromEntries(AREAS.map((a) => [a, fmt(value[a] ?? 0)]))
	);

	const PRESETS: { label: string; w: AreaWeights }[] = [
		{ label: '50 : 50', w: { schriftlich: 50, muendlich: 50, praktisch: 0 } },
		{ label: '2/3 : 1/3', w: { schriftlich: 200 / 3, muendlich: 100 / 3, praktisch: 0 } },
		{ label: '75 : 25', w: { schriftlich: 75, muendlich: 25, praktisch: 0 } },
		{ label: '1/3 : 2/3', w: { schriftlich: 100 / 3, muendlich: 200 / 3, praktisch: 0 } },
		{ label: '50 / 20 / 30', w: { schriftlich: 50, muendlich: 20, praktisch: 30 } }
	];

	const parsed = $derived(
		Object.fromEntries(AREAS.map((a) => [a, parsePercent(fields[a] ?? '') ?? 0])) as AreaWeights
	);
	const total = $derived(AREAS.reduce((s, a) => s + parsed[a], 0));
	const invalid = $derived(
		AREAS.some((a) => (fields[a] ?? '').trim() !== '' && parsePercent(fields[a]!) === null)
	);
</script>

<div class="weights">
	<div class="presets" role="group" aria-label="Vorlagen">
		{#each PRESETS as p (p.label)}
			<button
				type="button"
				class="secondary"
				{disabled}
				onclick={() => (fields = Object.fromEntries(AREAS.map((a) => [a, fmt(p.w[a])])))}
				>{p.label}</button
			>
		{/each}
	</div>
	<div class="fields">
		{#each AREAS as a (a)}
			<label>
				<span>{AREA_LABELS[a]}</span>
				<input name="w_{a}" bind:value={fields[a]} inputmode="decimal" placeholder="0" {disabled} />
			</label>
		{/each}
	</div>
	<p class="muted small" aria-live="polite">
		{#if invalid}
			<span class="error">Bitte Prozent (z. B. 75) oder Brüche (z. B. 1/3) eingeben.</span>
		{:else if total === 0}
			<span class="error">Mindestens ein Bereich braucht ein Gewicht.</span>
		{:else}
			= {formatAreaWeights(parsed)}{Math.abs(total - 100) > 0.5
				? ' (wird auf 100 % umgerechnet)'
				: ''}
		{/if}
	</p>
</div>

<style>
	.weights {
		display: grid;
		gap: 0.5rem;
	}
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.presets button {
		padding: 0.3rem 0.6rem;
		font-size: 0.85rem;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.fields label {
		display: grid;
		gap: 0.2rem;
		font-size: 0.85rem;
	}
	.small {
		font-size: 0.85rem;
		margin: 0;
	}
</style>
