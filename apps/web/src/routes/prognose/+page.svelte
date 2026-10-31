<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		HALF_YEARS,
		calculate,
		effectiveCoursePoints,
		effectiveExam,
		formatGrade,
		overallAverage,
		type PlanInput
	} from '@oberstufen-planer/abi-engine-bw';
	import { SvelteMap } from 'svelte/reactivity';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const courseMods = new SvelteMap<string, number>();
	const examMods = new SvelteMap<string, { written?: number; oral?: number }>();
	const zeugnis = $derived(new Set(data.zeugnis));
	const fallback = $derived(overallAverage(data.input.subjects));

	const scenario = $derived.by((): PlanInput => ({
		...data.input,
		subjects: data.input.subjects.map((s) => {
			const courses = { ...s.courses };
			for (const h of HALF_YEARS) {
				const mod = courseMods.get(`${s.id}:${h}`);
				if (mod !== undefined && courses[h]) courses[h] = { points: mod };
			}
			const em = examMods.get(s.id);
			return {
				...s,
				courses,
				examResult: em
					? {
							...s.examResult,
							...(em.written !== undefined ? { written: em.written } : {}),
							...(em.oral !== undefined ? { oral: em.oral } : {})
						}
					: s.examResult
			};
		})
	}));
	const result = $derived(calculate(scenario));
	const grade = $derived(result.gradeIgnoringConditions);
	const delta = $derived(
		grade !== null && data.baseline.grade !== null
			? Math.round((grade - data.baseline.grade) * 10) / 10
			: 0
	);
	const changes = $derived(courseMods.size + examMods.size);

	const baseCourse = (subjectId: string, h: (typeof HALF_YEARS)[number]) => {
		const s = data.input.subjects.find((x) => x.id === subjectId)!;
		return effectiveCoursePoints(s, h, fallback);
	};
	const baseExam = (subjectId: string) => {
		const s = data.input.subjects.find((x) => x.id === subjectId)!;
		return effectiveExam(s, fallback);
	};

	function setCourse(key: string, base: number, value: number) {
		if (value === base) courseMods.delete(key);
		else courseMods.set(key, value);
	}
	function setExamPart(
		id: string,
		part: 'written' | 'oral',
		base: number | undefined,
		value: number | undefined
	) {
		const cur = { ...(examMods.get(id) ?? {}) };
		if (value === base) delete cur[part];
		else cur[part] = value;
		if (cur.written === undefined && cur.oral === undefined) examMods.delete(id);
		else examMods.set(id, cur);
	}

	const payload = $derived(
		JSON.stringify({
			courses: [...courseMods]
				.filter(([key]) => !zeugnis.has(key))
				.map(([key, forecast]) => {
					const [subjectId, h] = key.split(':');
					return { subjectId, halfYear: Number(h), forecast };
				}),
			exams: [...examMods].map(([subjectId, v]) => ({ subjectId, ...v }))
		})
	);
	const points = Array.from({ length: 16 }, (_, i) => i);
</script>

<svelte:head><title>Was wäre wenn · Oberstufen-Planer</title></svelte:head>

<h1>Was wäre, wenn …?</h1>
<p class="muted">
	Ändere beliebige Noten und sieh sofort die Auswirkung. Nichts wird gespeichert, bis du es
	ausdrücklich übernimmst. Kursiv = Prognose, fett = Zeugnis.
</p>

<div class="bar card" aria-live="polite">
	<div>
		<span class="muted">Abiturnote</span>
		<strong class="grade">{grade !== null ? formatGrade(grade) : '–'}</strong>
		{#if delta !== 0}
			<span class="delta" class:better={delta < 0}
				>{delta < 0 ? '▲' : '▼'} {formatGrade(Math.abs(delta))}</span
			>
		{/if}
	</div>
	<div class="muted small">
		{result.total} Punkte (I: {result.blockI.points}, II: {result.blockII.points})
		{#if !result.passed}<span class="error">· Bedingungen nicht erfüllt</span>{/if}
	</div>
</div>

<section class="card table-wrap">
	<table>
		<thead>
			<tr
				><th>Fach</th>{#each HALF_YEARS as h (h)}<th class="c">{h}</th>{/each}<th class="c"
					>Prüfung</th
				></tr
			>
		</thead>
		<tbody>
			{#each data.subjects as s (s.id)}
				{@const ex = s.exam ? baseExam(s.id) : null}
				<tr>
					<th scope="row"><span class="dot" style:background={s.color}></span> {s.name}</th>
					{#each HALF_YEARS as h (h)}
						{@const key = `${s.id}:${h}`}
						{@const base = baseCourse(s.id, h)}
						<td class="c">
							{#if base}
								<select
									aria-label="{s.name} Halbjahr {h}"
									class:changed={courseMods.has(key)}
									class:real={base.actual}
									value={courseMods.get(key) ?? base.points}
									onchange={(e) => setCourse(key, base.points, Number(e.currentTarget.value))}
								>
									{#each points as p (p)}<option value={p}>{p}</option>{/each}
								</select>
							{:else}
								<span class="muted">·</span>
							{/if}
						</td>
					{/each}
					<td class="c">
						{#if ex?.written}
							<select
								aria-label="{s.name} schriftliche Prüfung"
								class:changed={examMods.get(s.id)?.written !== undefined}
								class:real={ex.written.actual}
								value={examMods.get(s.id)?.written ?? ex.written.points}
								onchange={(e) =>
									setExamPart(s.id, 'written', ex.written?.points, Number(e.currentTarget.value))}
							>
								{#each points as p (p)}<option value={p}>{p}</option>{/each}
							</select>
						{:else if s.exam === 'oral' && ex?.oral}
							<select
								aria-label="{s.name} mündliche Prüfung"
								class:changed={examMods.get(s.id)?.oral !== undefined}
								class:real={ex.oral.actual}
								value={examMods.get(s.id)?.oral ?? ex.oral.points}
								onchange={(e) =>
									setExamPart(s.id, 'oral', ex.oral?.points, Number(e.currentTarget.value))}
							>
								{#each points as p (p)}<option value={p}>{p}</option>{/each}
							</select>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

{#if form && 'error' in form && form.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form && 'saved' in form}<p class="ok">{form.saved} Prognose(n) gespeichert.</p>{/if}

<div class="actions bottom">
	<button
		type="button"
		class="secondary"
		disabled={changes === 0}
		onclick={() => {
			courseMods.clear();
			examMods.clear();
		}}
	>
		Änderungen verwerfen
	</button>
	<form
		method="POST"
		action="?/save"
		use:enhance={() =>
			async ({ update, result }) => {
				await update();
				if (result.type === 'success') {
					courseMods.clear();
					examMods.clear();
				}
			}}
	>
		<input type="hidden" name="payload" value={payload} />
		<button type="submit" disabled={changes === 0}>Als Prognose übernehmen</button>
	</form>
	<form
		method="POST"
		action="?/reset"
		use:enhance
		onsubmit={(e) => {
			if (!confirm('Alle gespeicherten Prognosen löschen?')) e.preventDefault();
		}}
	>
		<button type="submit" class="link">Alle Prognosen löschen</button>
	</form>
</div>
<p class="muted small">
	Zeugnisnoten und eingetragene Prüfungsergebnisse bleiben beim Übernehmen unverändert.
</p>

<style>
	.bar {
		position: sticky;
		top: 0.5rem;
		z-index: 2;
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.25rem 1rem;
		padding: 0.75rem 1rem;
	}
	.grade {
		font-size: 1.8rem;
		margin: 0 0.4rem;
	}
	.delta {
		font-weight: 700;
		color: var(--danger);
	}
	.delta.better {
		color: var(--accent);
	}
	.small {
		font-size: 0.85rem;
	}
	.ok {
		color: var(--accent);
	}
	section {
		margin-top: 1rem;
	}
	.table-wrap {
		padding: 0.5rem;
	}
	th,
	td {
		padding: 0.3rem 0.15rem;
	}
	th[scope='row'] {
		font-weight: 500;
		hyphens: auto;
	}
	.c {
		text-align: center;
	}
	select {
		padding: 0.3rem 0.1rem;
		min-width: 2.7rem;
		text-align: center;
		font-style: italic;
		font-variant-numeric: tabular-nums;
	}
	select.real {
		font-style: normal;
		font-weight: 700;
	}
	select.changed {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 18%, var(--bg));
		font-style: normal;
	}
	.bottom {
		margin-top: 1rem;
	}
	.bottom form {
		margin: 0;
	}
</style>
