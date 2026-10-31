<script lang="ts">
	import { enhance } from '$app/forms';
	import { CATEGORY_LABELS, type Category, type HalfYear } from '@oberstufen-planer/abi-engine-bw';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	interface Row {
		name: string;
		category: Category;
		selected: boolean;
		level: 'LF' | 'BF';
		oral: boolean;
		fromClass8: boolean;
		halfYears: HalfYear[];
		canBeLF: boolean;
		custom?: boolean;
	}

	const currentYear = new Date().getFullYear();
	// svelte-ignore state_referenced_locally
	let abiYear = $state<number | null>(data.profile.abiYear ?? currentYear + 2);
	// svelte-ignore state_referenced_locally
	let rows = $state<Row[]>(
		data.presets.map((p) => ({
			name: p.name,
			category: p.category,
			selected: p.compulsory === true,
			level: 'BF' as const,
			oral: false,
			fromClass8: p.fromClass8 ?? true,
			halfYears: [...p.halfYears],
			canBeLF: p.canBeLF === true
		}))
	);
	let customName = $state('');
	let customCategory = $state<Category>('sonstiges');

	const selected = $derived(rows.filter((r) => r.selected));
	const lfCount = $derived(selected.filter((r) => r.level === 'LF').length);
	const oralCount = $derived(selected.filter((r) => r.level === 'BF' && r.oral).length);
	const courseCount = $derived(selected.reduce((a, r) => a + r.halfYears.length, 0));
	const payload = $derived(
		JSON.stringify({
			abiYear,
			subjects: selected.map((r) => ({
				name: r.name,
				category: r.category,
				level: r.level,
				exam: r.level === 'LF' ? 'written' : r.oral ? 'oral' : null,
				fromClass8: r.fromClass8,
				halfYears: r.halfYears
			}))
		})
	);

	function toggleHalfYear(row: Row, h: HalfYear) {
		row.halfYears = row.halfYears.includes(h)
			? row.halfYears.filter((x) => x !== h)
			: [...row.halfYears, h].sort();
	}

	function addCustom() {
		const name = customName.trim();
		if (!name) return;
		rows.push({
			name,
			category: customCategory,
			selected: true,
			level: 'BF',
			oral: false,
			fromClass8: true,
			halfYears: [1, 2, 3, 4],
			canBeLF: true,
			custom: true
		});
		customName = '';
	}
</script>

<svelte:head><title>Einrichtung · Oberstufen-Planer</title></svelte:head>

<h1>Einrichtung</h1>

{#if data.hasSubjects}
	<p class="card">
		Deine Fächer sind schon angelegt. Änderungen kannst du unter <a href="/faecher">Fächer</a> vornehmen.
	</p>
{:else}
	<p class="muted">
		Wähle deine Fächer in der Kursstufe, deine drei Leistungsfächer und deine zwei mündlichen
		Prüfungsfächer. Alles lässt sich später noch ändern.
	</p>

	<form method="POST" use:enhance>
		<input type="hidden" name="payload" value={payload} />

		<section class="card">
			<label for="abiYear">Abiturjahr</label>
			<input id="abiYear" type="number" min="2020" max="2100" bind:value={abiYear} class="narrow" />
		</section>

		<div class="status" aria-live="polite">
			<span class:ok={lfCount === 3}>Leistungsfächer: {lfCount}/3</span>
			<span class:ok={oralCount === 2}>Mündliche Prüfungen: {oralCount}/2</span>
			<span class:ok={courseCount >= 42}>Kurse: {courseCount}</span>
		</div>

		<section class="card list">
			{#each rows as row, i (row.name + i)}
				<div class="row" class:selected={row.selected}>
					<label class="pick">
						<input type="checkbox" bind:checked={row.selected} />
						<span>
							<strong>{row.name}</strong>
							<small>{CATEGORY_LABELS[row.category]}</small>
						</span>
					</label>
					{#if row.selected}
						<div class="opts">
							<div class="seg" role="group" aria-label="Niveau {row.name}">
								<button
									type="button"
									class:on={row.level === 'BF'}
									onclick={() => (row.level = 'BF')}>Basisfach</button
								>
								<button
									type="button"
									class:on={row.level === 'LF'}
									disabled={!row.canBeLF}
									onclick={() => {
										row.level = 'LF';
										row.oral = false;
										row.halfYears = [1, 2, 3, 4];
									}}>Leistungsfach</button
								>
							</div>
							{#if row.level === 'BF'}
								<label class="inline"
									><input type="checkbox" bind:checked={row.oral} /> mündliche Prüfung</label
								>
							{:else}
								<span class="tag">schriftliche Prüfung</span>
							{/if}
							{#if row.category === 'fremdsprache'}
								<label class="inline"
									><input type="checkbox" bind:checked={row.fromClass8} /> ab Klasse 8 oder früher</label
								>
							{/if}
							<div class="hj" role="group" aria-label="Halbjahre {row.name}">
								{#each [1, 2, 3, 4] as const as h (h)}
									<button
										type="button"
										class:on={row.halfYears.includes(h)}
										aria-pressed={row.halfYears.includes(h)}
										onclick={() => toggleHalfYear(row, h)}>{h}</button
									>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/each}

			<div class="row add">
				<input placeholder="Weiteres Fach" bind:value={customName} />
				<select bind:value={customCategory} aria-label="Kategorie">
					{#each Object.entries(CATEGORY_LABELS) as [value, label] (value)}
						<option {value}>{label}</option>
					{/each}
				</select>
				<button type="button" onclick={addCustom}>Hinzufügen</button>
			</div>
		</section>

		{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
		<button type="submit">Fächer anlegen</button>
	</form>
{/if}

<style>
	.muted {
		color: var(--muted);
	}
	.narrow {
		max-width: 8rem;
		display: block;
		margin-top: 0.25rem;
	}
	.status {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		margin: 1rem 0;
		font-weight: 600;
		color: var(--danger);
	}
	.status .ok {
		color: var(--accent);
	}
	.list {
		padding: 0;
	}
	.row {
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--border);
	}
	.row:last-child {
		border-bottom: 0;
	}
	.pick {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		font-weight: 400;
		cursor: pointer;
	}
	.pick input,
	.inline input {
		width: auto;
	}
	.pick small {
		display: block;
		color: var(--muted);
	}
	.opts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: center;
		margin: 0.5rem 0 0.25rem 1.8rem;
	}
	.inline {
		font-weight: 400;
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}
	.add {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.add input {
		flex: 1 1 10rem;
		width: auto;
	}
	.error {
		color: var(--danger);
	}
	form > button[type='submit'] {
		margin-top: 1rem;
	}
</style>
