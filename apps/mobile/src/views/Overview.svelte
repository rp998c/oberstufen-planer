<script lang="ts">
	import {
		EVENT_KINDS,
		daysUntil,
		formatEventDate,
		toLocalDate
	} from '@oberstufen-planer/app-core';
	import { formatGrade } from '@oberstufen-planer/abi-engine-bw';
	import { app } from '../lib/app.svelte.ts';
	import { nav } from '../lib/nav.svelte.ts';
	import SyncLine from './SyncLine.svelte';

	const r = $derived(app.result);
	const today = toLocalDate(new Date());
	const events = $derived(
		[...app.snapshot.data.events]
			.filter((e) => (e.end ?? e.start).slice(0, 10) >= today)
			.sort((a, b) => a.start.localeCompare(b.start))
			.slice(0, 4)
	);
	const tasks = $derived(
		app.snapshot.data.tasks
			.filter((t) => !t.done)
			.sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
			.slice(0, 3)
	);
	const subject = (id: string | null) => app.snapshot.data.subjects.find((s) => s.id === id);
	const when = (start: string) => {
		const d = daysUntil(start);
		return d <= 0 ? 'heute' : d === 1 ? 'morgen' : `in ${d} T.`;
	};
</script>

<SyncLine />

{#if app.snapshot.data.subjects.length === 0}
	<section class="card">
		<h2>Noch keine Fächer</h2>
		<p class="muted">
			Lege deine Fächer einmal im Browser unter „Einrichtung“ an – danach erscheinen sie hier.
		</p>
	</section>
{:else}
	<section class="card hero">
		<div>
			<div class="muted">{r.projected ? 'Hochgerechnete Abiturnote' : 'Abiturnote'}</div>
			<div class="big">
				{r.gradeIgnoringConditions !== null ? formatGrade(r.gradeIgnoringConditions) : '–'}
			</div>
			<div class={r.passed ? 'ok' : 'error'}>
				{r.passed ? 'Bedingungen erfüllt' : 'Bedingungen noch nicht erfüllt'}
			</div>
		</div>
		<dl>
			<dt>Block I</dt>
			<dd>{r.blockI.points} / 600</dd>
			<dt>Block II</dt>
			<dd>{r.blockII.points} / 300</dd>
			<dt>Gesamt</dt>
			<dd><strong>{r.total}</strong></dd>
			<dt>Unterkurse</dt>
			<dd>{r.blockI.unterkurse} / 8</dd>
		</dl>
	</section>
{/if}

<section class="card list-card">
	<div class="row">
		<h2 class="grow">Nächste Termine</h2>
		<button class="link" onclick={() => nav.go('calendar')}>Alle</button>
	</div>
	{#each events as e (e.id)}
		<div class="row">
			<span class="bar" style:background={subject(e.subjectId)?.color ?? 'var(--border)'}></span>
			<strong class="when">{when(e.start)}</strong>
			<span class="grow">
				<strong>{e.title}</strong><br />
				<small class="muted"
					>{EVENT_KINDS[e.kind as keyof typeof EVENT_KINDS] ?? 'Termin'} · {formatEventDate(
						e.start,
						e.allDay
					)}</small
				>
			</span>
		</div>
	{:else}
		<p class="row muted">Keine anstehenden Termine.</p>
	{/each}
</section>

{#if tasks.length}
	<section class="card list-card">
		<div class="row">
			<h2 class="grow">Offene Aufgaben</h2>
			<button class="link" onclick={() => nav.go('tasks')}>Alle</button>
		</div>
		{#each tasks as t (t.id)}
			<div class="row">
				<span class="grow">{t.title}</span>
				{#if t.due}<small class="muted"
						>{new Date(t.due + 'T00:00').toLocaleDateString('de-DE', {
							day: '2-digit',
							month: '2-digit'
						})}</small
					>{/if}
			</div>
		{/each}
	</section>
{/if}

{#if r.issues.length}
	<section class="card">
		<h2>Hinweise</h2>
		<ul class="issues">
			{#each r.issues as issue, i (i)}<li class={issue.severity}>{issue.message}</li>{/each}
		</ul>
	</section>
{/if}

<style>
	.hero {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 2rem;
		align-items: center;
		justify-content: space-between;
		margin-top: 0.75rem;
	}
	.big {
		font-size: 3rem;
		font-weight: 800;
		line-height: 1.1;
	}
	dl {
		display: grid;
		grid-template-columns: auto auto;
		gap: 0.2rem 1rem;
		margin: 0;
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.bar {
		width: 4px;
		align-self: stretch;
		border-radius: 2px;
	}
	.when {
		min-width: 4rem;
	}
	h2 {
		margin: 0;
	}
	p.row {
		margin: 0;
	}
</style>
