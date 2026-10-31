<script lang="ts">
	import { formatGrade } from '@oberstufen-planer/abi-engine-bw';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const r = $derived(data.result);
	const errors = $derived(r.issues.filter((i) => i.severity === 'error'));
</script>

<svelte:head><title>Übersicht · Oberstufen-Planer</title></svelte:head>

<h1>Übersicht</h1>

<section class="card hero">
	<div>
		<div class="muted">{r.projected ? 'Hochgerechnete' : ''} Abiturnote</div>
		<div class="big">
			{r.gradeIgnoringConditions !== null ? formatGrade(r.gradeIgnoringConditions) : '–'}
		</div>
		{#if errors.length}<div class="error">Bedingungen noch nicht erfüllt</div>{/if}
	</div>
	<dl>
		<dt>Block I</dt>
		<dd>{r.blockI} / 600</dd>
		<dt>Block II</dt>
		<dd>{r.blockII} / 300</dd>
		<dt>Gesamt</dt>
		<dd><strong>{r.total} / 900</strong></dd>
	</dl>
</section>

{#if r.projected}
	<p class="muted">
		Fehlende Noten werden mit deiner Prognose oder deinem bisherigen Durchschnitt hochgerechnet.
	</p>
{/if}

{#if r.issues.length}
	<section class="card">
		<h2>Hinweise</h2>
		<ul class="issues">
			{#each r.issues as issue, i (i)}
				<li class={issue.severity}>{issue.message}</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	h2 {
		font-size: 1.05rem;
		margin-top: 0;
	}
	section {
		margin-top: 1rem;
	}
	.hero {
		display: flex;
		gap: 2rem;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
	}
	.big {
		font-size: 3.2rem;
		font-weight: 800;
		line-height: 1.1;
	}
	dl {
		display: grid;
		grid-template-columns: auto auto;
		gap: 0.25rem 1rem;
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
</style>
