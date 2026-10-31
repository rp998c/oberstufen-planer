<script lang="ts">
	import { HALF_YEARS, formatGrade } from '@oberstufen-planer/abi-engine-bw';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const r = $derived(data.result);
	const courses = $derived(
		new Map([...r.blockI.counted, ...r.blockI.notCounted].map((c) => [c.key, c]))
	);
	const counted = $derived(new Set(r.blockI.counted.map((c) => c.key)));
	const exam = (id: string) => r.blockII.exams.find((e) => e.subjectId === id);
</script>

<svelte:head><title>Zusammenfassung · Oberstufen-Planer</title></svelte:head>

<div class="no-print actions top">
	<a href="/mehr">← Mehr</a>
	<button type="button" onclick={() => window.print()}>Drucken / als PDF speichern</button>
</div>

<article class="sheet">
	<div class="title">
		<h1>Abitur-Übersicht{data.profile.abiYear ? ` ${data.profile.abiYear}` : ''}</h1>
		<p class="muted">
			Stand {new Date(data.created).toLocaleDateString('de-DE')} · {r.projected
				? 'mit Prognosen für fehlende Noten'
				: 'alle Noten eingetragen'}
		</p>
	</div>

	<div class="summary">
		<div>
			<span class="muted">Durchschnittsnote</span><strong class="big"
				>{r.gradeIgnoringConditions !== null ? formatGrade(r.gradeIgnoringConditions) : '–'}</strong
			>
		</div>
		<div><span class="muted">Block I</span><strong>{r.blockI.points} / 600</strong></div>
		<div><span class="muted">Block II</span><strong>{r.blockII.points} / 300</strong></div>
		<div><span class="muted">Gesamt</span><strong>{r.total} / 900</strong></div>
	</div>
	{#if !r.passed}<p class="error">Achtung: Nicht alle Zulassungsbedingungen sind erfüllt.</p>{/if}

	<h2>Block I – Kurse</h2>
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
				{@const e = exam(s.id)}
				<tr>
					<th scope="row"
						>{s.name}{s.level === 'LF' ? ' (LF)' : ''}{r.blockI.doubled.includes(s.id)
							? ' ×2'
							: ''}</th
					>
					{#each HALF_YEARS as h (h)}
						{@const c = courses.get(`${s.id}:${h}`)}
						<td class="c" class:in={counted.has(`${s.id}:${h}`)} class:proj={c && !c.actual}>
							{c ? c.points : ''}
						</td>
					{/each}
					<td class="c"
						>{e
							? `${e.written ?? ''}${e.written !== undefined && e.oral !== undefined ? '/' : ''}${e.kind !== 'written' || e.oral !== undefined ? (e.oral ?? '') : ''} → ${e.points}`
							: ''}</td
					>
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="legend muted">
		Umrandet = angerechnet · kursiv = Prognose · ×2 = doppelt gewichtet ·
		{r.blockI.unterkurse} unterpunktete Kurse ({r.blockI.unterkurseLF} in Leistungsfächern) · Summe {r
			.blockI.rawSum} × 40 / 48 = {r.blockI.points}
	</p>

	{#if r.issues.length}
		<h2>Hinweise</h2>
		<ul>
			{#each r.issues as issue, i (i)}<li>{issue.message}</li>{/each}
		</ul>
	{/if}

	<p class="muted foot">
		Erstellt mit dem Oberstufen-Planer. Planungshilfe – verbindlich ist die Berechnung der Schule.
		{#if r.blockI.counted.some((c) => c.subjectId === 'bll')}Besondere Lernleistung in Block I
			berücksichtigt.{/if}
	</p>
</article>

<style>
	.top {
		justify-content: space-between;
		margin-bottom: 1rem;
	}
	.sheet {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 1.25rem;
	}
	h1 {
		margin-bottom: 0.25rem;
	}
	h2 {
		font-size: 1.05rem;
		margin: 1.5rem 0 0.5rem;
	}
	.summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}
	.summary div {
		display: grid;
	}
	.big {
		font-size: 2rem;
	}
	table {
		font-size: 0.9rem;
	}
	th,
	td {
		padding: 0.3rem 0.25rem;
	}
	th[scope='row'] {
		font-weight: 500;
	}
	.c {
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	td.in {
		outline: 1.5px solid var(--text);
		outline-offset: -3px;
		border-radius: 4px;
		font-weight: 700;
	}
	td.proj {
		font-style: italic;
	}
	.legend,
	.foot {
		font-size: 0.8rem;
	}
	.foot {
		margin-top: 1.5rem;
	}
	@media print {
		:global(header),
		:global(nav.main),
		:global(footer),
		.no-print {
			display: none !important;
		}
		:global(body) {
			background: #fff;
			color: #000;
		}
		:global(main) {
			max-width: none;
			padding: 0;
		}
		.sheet {
			border: 0;
			padding: 0;
		}
	}
</style>
