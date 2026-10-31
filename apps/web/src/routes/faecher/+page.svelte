<script lang="ts">
	import { HALF_YEARS } from '@oberstufen-planer/abi-engine-bw';
	import { EXAM_LABELS, LEVEL_LABELS } from '$lib/subjects.ts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Fächer · Oberstufen-Planer</title></svelte:head>

<div class="actions head">
	<h1>Fächer</h1>
	<a class="button" href="/faecher/neu">+ Fach</a>
</div>

{#if data.justCreated}
	<p class="card">
		Deine Fächer sind angelegt. Als Nächstes kannst du unter <a href="/noten">Noten</a> deine Noten eintragen.
	</p>
{/if}

{#if data.subjects.length === 0}
	<p class="card">Noch keine Fächer. <a href="/einrichtung">Zur Einrichtung</a></p>
{:else}
	{#if data.issues.length}
		<section class="card">
			<h2>Hinweise zur Fächerwahl</h2>
			<ul class="issues">
				{#each data.issues as issue (issue.code + (issue.subjectId ?? ''))}
					<li class={issue.severity}>{issue.message}</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="card list">
		{#each data.subjects as s (s.id)}
			<a class="row" href="/faecher/{s.id}">
				<span class="dot" style:background={s.color}></span>
				<span class="name">{s.name}</span>
				<span class="tag">{LEVEL_LABELS[s.level]}</span>
				{#if s.exam}<span class="tag">Prüfung {EXAM_LABELS[s.exam]}</span>{/if}
				<span class="hjs" aria-label="Halbjahre">
					{#each HALF_YEARS as h (h)}
						<span class:on={s.courses[h]}>{h}</span>
					{/each}
				</span>
			</a>
		{/each}
	</section>
{/if}

<style>
	.head {
		justify-content: space-between;
	}
	.head h1 {
		margin: 0;
	}
	.button {
		background: var(--accent);
		color: var(--accent-text);
		padding: 0.5rem 0.9rem;
		border-radius: 8px;
		text-decoration: none;
		font-weight: 600;
	}
	h2 {
		font-size: 1.05rem;
		margin-top: 0;
	}
	section {
		margin-top: 1rem;
	}
	.list {
		padding: 0;
	}
	.row {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		flex-wrap: wrap;
		padding: 0.7rem 1rem;
		border-bottom: 1px solid var(--border);
		color: var(--text);
		text-decoration: none;
	}
	.row:last-child {
		border-bottom: 0;
	}
	.name {
		font-weight: 600;
		flex: 1 1 8rem;
	}
	.hjs {
		display: inline-flex;
		gap: 0.2rem;
	}
	.hjs span {
		width: 1.5rem;
		text-align: center;
		font-size: 0.8rem;
		border-radius: 4px;
		color: var(--muted);
		border: 1px dashed var(--border);
	}
	.hjs span.on {
		border-style: solid;
		color: var(--text);
	}
</style>
