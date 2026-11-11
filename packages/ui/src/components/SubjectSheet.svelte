<script lang="ts">
	import {
		CATEGORY_LABELS,
		parsePercent,
		type Category,
		type HalfYear
	} from '@oberstufen-planer/abi-engine-bw';
	import {
		HALF_YEAR_SHORT,
		OpError,
		SUBJECT_COLORS,
		SUBJECT_PRESETS,
		TEST_MODE_LABELS,
		defaultGrading,
		type Subject,
		type TestMode
	} from '@oberstufen-planer/app-core';
	import { weightText } from '../lib/format.ts';
	import { newId, store } from '../lib/store.svelte.ts';
	import Sheet from './Sheet.svelte';

	/** Edit a subject (or create one when `subject` is null). */
	let { onclose, subject = null }: { onclose: () => void; subject?: Subject | null } = $props();

	// svelte-ignore state_referenced_locally
	const s0 = subject;
	const used = new Set(store.data.subjects.map((s) => s.name));
	const presets = SUBJECT_PRESETS.filter((p) => !used.has(p.name));
	let preset = $state(s0 ? '' : (presets[0]?.name ?? '__custom'));
	let name = $state(s0?.name ?? '');
	let category = $state<Category>(s0?.category ?? 'sonstiges');
	let level = $state(s0?.level ?? 'BF');
	let exam = $state<string>(s0?.exam ?? '');
	let klausuren = $state(String(s0?.klausuren ?? 1));
	let tests = $state<TestMode>(s0?.tests ?? 'none');
	let ws = $state(weightText(s0?.weights.schriftlich ?? 200 / 3));
	let wm = $state(weightText(s0?.weights.muendlich ?? 100 / 3));
	let wp = $state(weightText(s0?.weights.praktisch ?? 0));
	let halfYears = $state<HalfYear[]>(s0?.halfYears ?? [1, 2, 3, 4]);
	let color = $state(
		s0?.color ?? SUBJECT_COLORS[store.data.subjects.length % SUBJECT_COLORS.length]!
	);
	let error = $state('');

	$effect(() => {
		if (s0 || preset === '__custom') return;
		const p = SUBJECT_PRESETS.find((x) => x.name === preset);
		if (!p) return;
		name = p.name;
		category = p.category;
		halfYears = [...p.halfYears];
		const g = defaultGrading(p.category, level);
		klausuren = String(g.klausuren);
		ws = weightText(g.weights.schriftlich);
		wm = weightText(g.weights.muendlich);
		wp = weightText(g.weights.praktisch);
	});

	function toggle(h: HalfYear) {
		halfYears = halfYears.includes(h) ? halfYears.filter((x) => x !== h) : [...halfYears, h].sort();
	}

	function save(e: Event) {
		e.preventDefault();
		error = '';
		const w = [ws, wm, wp].map((v) => (v.trim() === '' ? 0 : parsePercent(v)));
		if (w.some((x) => x === null)) {
			error = 'Gewichte als Prozent (z. B. 60) oder Bruch (z. B. 2/3) eingeben.';
			return;
		}
		try {
			store.mutate({
				type: 'subject.upsert',
				subject: {
					id: s0?.id ?? newId(),
					sortOrder: s0?.sortOrder ?? store.data.subjects.length,
					name: name.trim(),
					color,
					category,
					level: level as 'LF' | 'BF',
					exam: level === 'LF' ? 'written' : exam === 'oral' ? 'oral' : null,
					fromClass8: s0?.fromClass8 ?? true,
					halfYears,
					klausuren: Number(klausuren),
					tests,
					weights: { schriftlich: w[0]!, muendlich: w[1]!, praktisch: w[2]! }
				}
			});
			onclose();
		} catch (err) {
			error = err instanceof OpError ? err.message : String(err);
		}
	}

	function remove() {
		if (!s0 || !confirm(`${s0.name} mit allen Noten löschen?`)) return;
		store.mutate({ type: 'subject.delete', id: s0.id });
		onclose();
	}
</script>

<Sheet title={s0 ? s0.name : 'Fach hinzufügen'} {onclose} width={500}>
	<form class="form" onsubmit={save}>
		{#if !s0}
			<label class="field">
				<span>Fach</span>
				<select class="input" bind:value={preset}>
					{#each presets as p (p.name)}<option value={p.name}>{p.name}</option>{/each}
					<option value="__custom">Anderes Fach …</option>
				</select>
			</label>
		{/if}
		{#if s0 || preset === '__custom'}
			<div class="row2">
				<label class="field"
					><span>Name</span><input class="input" maxlength="60" required bind:value={name} /></label
				>
				<label class="field">
					<span>Art</span>
					<select class="input" bind:value={category}>
						{#each Object.entries(CATEGORY_LABELS) as [k, l] (k)}<option value={k}>{l}</option
							>{/each}
					</select>
				</label>
			</div>
		{/if}
		<div class="row2">
			<label class="field">
				<span>Niveau</span>
				<select class="input" bind:value={level}
					><option value="LF">Leistungsfach</option><option value="BF">Basisfach</option></select
				>
			</label>
			<label class="field">
				<span>Abiturprüfung</span>
				{#if level === 'LF'}
					<select class="input" disabled><option>schriftlich</option></select>
				{:else}
					<select class="input" bind:value={exam}
						><option value="">keine</option><option value="oral">mündlich</option></select
					>
				{/if}
			</label>
		</div>
		<div class="row2">
			<label class="field"
				><span>Klausuren pro Halbjahr</span><input
					class="input"
					type="number"
					min="0"
					max="4"
					inputmode="numeric"
					bind:value={klausuren}
				/></label
			>
			<label class="field">
				<span>Tests</span>
				<select class="input" bind:value={tests}>
					{#each Object.entries(TEST_MODE_LABELS) as [k, l] (k)}<option value={k}>{l}</option
						>{/each}
				</select>
			</label>
		</div>
		<div class="field">
			<span>Gewichtung schriftlich · mündlich · praktisch</span>
			<div class="row3">
				<input class="input" aria-label="schriftlich" bind:value={ws} placeholder="–" />
				<input class="input" aria-label="mündlich" bind:value={wm} placeholder="–" />
				<input class="input" aria-label="praktisch" bind:value={wp} placeholder="–" />
			</div>
			<span class="tiny muted"
				>Prozent (60) oder Bruch (2/3). Leer = gibt es in dem Fach nicht.</span
			>
		</div>
		<div class="field">
			<span>Halbjahre</span>
			<div class="hjs">
				{#each [1, 2, 3, 4] as const as h (h)}
					<label class="check"
						><input
							type="checkbox"
							checked={halfYears.includes(h)}
							onchange={() => toggle(h)}
						/>{HALF_YEAR_SHORT[h]}</label
					>
				{/each}
			</div>
		</div>
		<div class="field">
			<span>Farbe</span>
			<div class="colors">
				{#each SUBJECT_COLORS as c (c)}
					<button
						type="button"
						class="sw"
						class:on={c === color}
						style:background={c}
						aria-label="Farbe {c}"
						aria-pressed={c === color}
						onclick={() => (color = c)}
					></button>
				{/each}
				<label
					class="sw custom"
					class:on={!SUBJECT_COLORS.includes(color)}
					style:background={SUBJECT_COLORS.includes(color) ? null : color}
					title="Eigene Farbe"
				>
					<input
						type="color"
						value={color}
						oninput={(e) => (color = e.currentTarget.value.toUpperCase())}
						aria-label="Eigene Farbe wählen"
					/>
				</label>
			</div>
		</div>
		{#if error}<p class="error-text" role="alert">{error}</p>{/if}
		<div class="btns">
			{#if s0}<button type="button" class="btn danger" onclick={remove}>Löschen</button>{/if}
			<button class="btn accent big" type="submit">{s0 ? 'Speichern' : 'Hinzufügen'}</button>
		</div>
	</form>
</Sheet>

<style>
	.form {
		display: grid;
		gap: 14px;
	}
	.row2 {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 10px;
	}
	.row3 {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.hjs {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 18px;
	}
	.colors {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.sw {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 0;
		cursor: pointer;
	}
	.sw.custom {
		position: relative;
		background: conic-gradient(#e5484d, #f5a524, #46a758, #12a594, #3e63dd, #8e4ec6, #e5484d);
	}
	.sw.custom input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.sw.on {
		outline: 2px solid var(--text);
		outline-offset: 2px;
	}
	.btns {
		display: flex;
		gap: 10px;
	}
	.btns .accent {
		flex: 1;
	}
</style>
