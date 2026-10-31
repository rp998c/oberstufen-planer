<script lang="ts">
	import { formatGrade } from '@oberstufen-planer/abi-engine-bw';
	import Trend from '$lib/components/Trend.svelte';
	import { EVENT_KINDS, daysUntil, formatEventDate } from '$lib/calendar.ts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const r = $derived(data.result);
	const fmt = (x: number | null, d = 1) => (x === null ? '–' : x.toFixed(d).replace('.', ','));
	const strong = $derived(new Set(data.strong));
	const weak = $derived(new Set(data.weak));
	const sorted = $derived([...data.subjects].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)));
</script>

<svelte:head><title>Übersicht · Oberstufen-Planer</title></svelte:head>

<h1>Übersicht</h1>

<section class="card hero">
	<div>
		<div class="muted">{r.projected ? 'Hochgerechnete Abiturnote' : 'Abiturnote'}</div>
		<div class="big">
			{r.gradeIgnoringConditions !== null ? formatGrade(r.gradeIgnoringConditions) : '–'}
		</div>
		<div class={r.passed ? 'ok' : 'error'}>
			{r.passed ? 'Alle Bedingungen erfüllt' : 'Bedingungen noch nicht erfüllt'}
		</div>
	</div>
	<div class="meters">
		{@render meter('Block I', r.blockI, 600, 200)}
		{@render meter('Block II', r.blockII, 300, 100)}
		<div class="total">Gesamt <strong>{r.total}</strong> / 900</div>
	</div>
</section>

<div class="tiles">
	<div class="card tile">
		<div class="muted">Zeugnis-Schnitt</div>
		<div class="value">{fmt(data.zeugnisAvg)}</div>
		<div class="muted small">Punkte aus {data.gradedCourses} von {data.totalCourses} Kursen</div>
	</div>
	<div class="card tile">
		<div class="muted">Unterkurse</div>
		<div class="value" class:error={r.unterkurse > 8}>
			{r.unterkurse} <span class="of">/ 8</span>
		</div>
		<div class="muted small" class:error={r.unterkurseLF > 3}>
			davon {r.unterkurseLF} von 3 in Leistungsfächern
		</div>
	</div>
	<a class="card tile link" href="/prognose">
		<div class="muted">Was wäre, wenn …?</div>
		<div class="value">→</div>
		<div class="muted small">Szenarien durchspielen</div>
	</a>
</div>

<section class="card next">
	<div class="next-head">
		<h2>Nächste Termine</h2>
		<a href="/kalender">Kalender →</a>
	</div>
	{#if data.nextEvents.length === 0}
		<p class="muted small">Keine anstehenden Termine. <a href="/kalender">Klausur eintragen</a></p>
	{:else}
		<ul>
			{#each data.nextEvents as e (e.id)}
				{@const d = daysUntil(e.start)}
				<li>
					<span class="bar" style:background={e.color ?? 'var(--border)'}></span>
					<span class="when">{d <= 0 ? 'heute' : d === 1 ? 'morgen' : `in ${d} T.`}</span>
					<span class="what">
						<strong>{e.title}</strong>
						<small class="muted"
							>{EVENT_KINDS[e.kind as keyof typeof EVENT_KINDS] ?? 'Termin'}{e.subject
								? ` · ${e.subject}`
								: ''} · {formatEventDate(e.start, e.allDay)}</small
						>
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section>
	<h2>Fächer</h2>
	<p class="muted small">
		Verlauf über die vier Halbjahre (gefüllt = Zeugnis, hohl = Prognose; gestrichelt = 5 Punkte).
	</p>
	<div class="subjects">
		{#each sorted as s (s.id)}
			<a class="card subject" href="/noten" aria-label="{s.name}, Schnitt {fmt(s.avg)} Punkte">
				<div class="head">
					<span class="dot" style:background={s.color}></span>
					<strong>{s.name}</strong>
					<span class="avg">{fmt(s.avg)}</span>
				</div>
				{#if strong.has(s.id)}<span class="tag good">läuft gut</span>
				{:else if weak.has(s.id)}<span class="tag">Potenzial</span>{/if}
				<Trend points={s.points} color={s.color} label={s.name} />
			</a>
		{/each}
	</div>
</section>

{#if r.issues.length}
	<section class="card">
		<h2>Hinweise</h2>
		<ul class="issues">
			{#each r.issues as issue, i (i)}
				<li class={issue.severity}>{issue.message}</li>
			{/each}
		</ul>
		<p><a href="/abitur">Details unter Abitur →</a></p>
	</section>
{/if}

{#snippet meter(label: string, value: number, max: number, min: number)}
	<div class="meter">
		<div class="meter-head"><span>{label}</span><span><strong>{value}</strong> / {max}</span></div>
		<div
			class="track"
			role="meter"
			aria-valuemin={0}
			aria-valuemax={max}
			aria-valuenow={value}
			aria-label={label}
		>
			<div class="fill" style:width="{Math.min(100, (value / max) * 100)}%"></div>
			<div class="min" style:left="{(min / max) * 100}%" title="Mindestens {min}"></div>
		</div>
	</div>
{/snippet}

<style>
	h2 {
		font-size: 1.05rem;
		margin: 0 0 0.25rem;
	}
	section {
		margin-top: 1.25rem;
	}
	.small {
		font-size: 0.85rem;
	}
	.ok {
		color: var(--accent);
	}
	.hero {
		display: flex;
		gap: 1.5rem 2rem;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
	}
	.big {
		font-size: 3.2rem;
		font-weight: 800;
		line-height: 1.1;
	}
	.meters {
		flex: 1 1 14rem;
		display: grid;
		gap: 0.6rem;
	}
	.meter-head {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
	}
	.track {
		position: relative;
		height: 8px;
		border-radius: 4px;
		background: var(--bg);
		border: 1px solid var(--border);
		margin-top: 0.2rem;
	}
	.fill {
		height: 100%;
		border-radius: 4px;
		background: var(--accent);
	}
	.min {
		position: absolute;
		top: -3px;
		bottom: -3px;
		width: 2px;
		background: var(--text);
		opacity: 0.5;
	}
	.total {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}
	.tile .value {
		font-size: 1.8rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.of {
		font-size: 1rem;
		color: var(--muted);
		font-weight: 500;
	}
	.link {
		color: var(--text);
		text-decoration: none;
	}
	.subjects {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
		gap: 0.75rem;
		margin-top: 0.5rem;
	}
	.subject {
		min-width: 0;
		padding: 0.75rem;
		color: var(--text);
		text-decoration: none;
		display: grid;
		gap: 0.4rem;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
	}
	.subject > .tag {
		justify-self: start;
	}
	.head strong {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.avg {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.next-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.next ul {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
		display: grid;
		gap: 0.5rem;
	}
	.next li {
		display: flex;
		gap: 0.6rem;
		align-items: stretch;
	}
	.next .bar {
		width: 4px;
		border-radius: 2px;
		flex: none;
	}
	.when {
		min-width: 4.2rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.what {
		display: grid;
		min-width: 0;
	}
	.tag.good {
		color: var(--accent);
		border-color: var(--accent);
	}
</style>
