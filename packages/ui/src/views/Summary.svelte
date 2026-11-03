<script lang="ts">
	import { HALF_YEARS } from '@oberstufen-planer/abi-engine-bw';
	import { HALF_YEAR_SHORT } from '@oberstufen-planer/app-core';
	import Icon from '../components/Icon.svelte';
	import { fmt1 } from '../lib/format.ts';
	import { store } from '../lib/store.svelte.ts';

	const r = $derived(store.result);
	const grade = $derived(r.grade ?? r.gradeIgnoringConditions);
	const counted = $derived(new Set(r.blockI.counted.map((c) => `${c.subjectId}:${c.halfYear}`)));
	const exams = $derived(store.views.map((v) => v.subject).filter((s) => s.exam));
	const examOf = (id: string) => store.data.exams.find((e) => e.subjectId === id);
	const line = (id: string) => r.blockII.exams.find((e) => e.subjectId === id);
	const date = new Date().toLocaleDateString('de-DE', { dateStyle: 'long' });
</script>

<div class="paper light acc-{store.prefs.accent}">
	<div class="bar no-print">
		<button class="btn" type="button" onclick={() => history.back()}
			><Icon name="back" size={16} /> Zurück</button
		>
		<button class="btn primary" type="button" onclick={() => print()}
			><Icon name="print" size={16} /> Drucken / als PDF</button
		>
	</div>

	<header>
		<h1>Abitur-Übersicht</h1>
		<p class="muted">
			Stand {date}{store.data.profile.abiYear ? ` · Abitur ${store.data.profile.abiYear}` : ''} · Baden-Württemberg
		</p>
	</header>

	<div class="kpis">
		<div>
			<span class="muted">Durchschnitt</span><strong>{grade === null ? '–' : fmt1(grade)}</strong>
		</div>
		<div><span class="muted">Gesamt</span><strong>{r.total} / 900</strong></div>
		<div><span class="muted">Block I</span><strong>{r.blockI.points} / 600</strong></div>
		<div><span class="muted">Block II</span><strong>{r.blockII.points} / 300</strong></div>
	</div>
	{#if r.projected}<p class="small muted">
			Noch nicht feststehende Kurse und Prüfungen sind geschätzt (≈). Eingeklammert = zählt nicht.
		</p>{/if}

	<h2>Kurse</h2>
	<table>
		<thead
			><tr
				><th>Fach</th><th>Niveau</th>{#each HALF_YEARS as h (h)}<th class="c"
						>{HALF_YEAR_SHORT[h]}</th
					>{/each}</tr
			></thead
		>
		<tbody>
			{#each store.views as v (v.subject.id)}
				<tr>
					<td>{v.subject.name}</td>
					<td>{v.subject.level}</td>
					{#each HALF_YEARS as h (h)}
						{@const c = v.halfYears[h]}
						{@const isCounted = counted.has(`${v.subject.id}:${h}`)}
						<td class="c">
							{#if c}
								{@const val =
									c.source === 'zeugnis'
										? String(c.zeugnis)
										: c.effective !== null
											? `≈ ${c.effective}`
											: '–'}
								{isCounted ? val : `(${val})`}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>

	<h2>Prüfungen</h2>
	<table>
		<thead
			><tr><th>Fach</th><th>Art</th><th class="c">Punkte</th><th class="c">Wertung</th></tr></thead
		>
		<tbody>
			{#each exams as s (s.id)}
				{@const e = examOf(s.id)}
				{@const l = line(s.id)}
				<tr>
					<td>{s.name}</td>
					<td>{s.exam === 'written' ? 'schriftlich' : 'mündlich'}</td>
					<td class="c"
						>{s.exam === 'written' ? (e?.written ?? '≈') : (e?.oral ?? '≈')}{s.exam === 'written' &&
						e?.oral != null
							? ` + mdl. ${e.oral}`
							: ''}</td
					>
					<td class="c">{l ? `${l.actual ? '' : '≈ '}${l.points}` : '–'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="tiny muted foot">
		Erstellt mit dem Oberstufen-Planer. Planungshilfe – verbindlich ist die Berechnung der Schule.
	</p>
</div>

<style>
	.paper {
		max-width: 820px;
		margin: 0 auto;
		padding: 28px 24px 48px;
		background: #fff;
		color: #17171c;
		min-height: 100dvh;
	}
	.bar {
		display: flex;
		justify-content: space-between;
		margin-bottom: 24px;
	}
	header p {
		margin: 6px 0 0;
	}
	.kpis {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 10px;
		margin: 22px 0 8px;
	}
	.kpis div {
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 10px 12px;
		display: grid;
		gap: 2px;
		font-size: 13px;
	}
	.kpis strong {
		font-size: 22px;
	}
	h2 {
		font-size: 16px;
		margin: 24px 0 8px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	th,
	td {
		border-bottom: 1px solid var(--line);
		padding: 6px 8px;
		text-align: left;
	}
	th {
		color: var(--muted);
		font-weight: 600;
	}
	.c {
		text-align: center;
	}
	.foot {
		margin-top: 28px;
	}
	@media print {
		.paper {
			padding: 0;
		}
	}
</style>
