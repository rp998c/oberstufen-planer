<script lang="ts">
	import { enhance } from '$app/forms';
	import { daysUntil } from '$lib/calendar.ts';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const subject = (id: string | null) => data.subjects.find((s) => s.id === id);
	const isPast = (g: PageData['goals'][number]) =>
		g.achieved || (g.due !== null && daysUntil(g.due) < 0);
	const current = $derived(data.goals.filter((g) => !isPast(g)));
	const past = $derived(data.goals.filter(isPast));
	let editing = $state<string | null>(null);
	const fmt = (x: number) => x.toFixed(1).replace('.', ',');
</script>

<svelte:head><title>Lernziele · Oberstufen-Planer</title></svelte:head>

<p><a href="/mehr">← Mehr</a></p>
<h1>Lernziele</h1>

{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

<section class="card">
	<h2>Neues Lernziel</h2>
	{@render goalForm()}
</section>

<section class="goals">
	{#each current as g (g.id)}{@render goal(g)}{:else}<p class="muted">
			Noch keine aktuellen Lernziele.
		</p>{/each}
</section>

{#if past.length}
	<h2 class="past-title">Vergangene Lernziele</h2>
	<section class="goals past">
		{#each past as g (g.id)}{@render goal(g)}{/each}
	</section>
{/if}

{#snippet goalForm(g?: PageData['goals'][number])}
	<form
		method="POST"
		action="?/save"
		class="stack"
		use:enhance={() =>
			async ({ update, result }) => {
				await update({ reset: !g });
				if (result.type === 'success') editing = null;
			}}
	>
		<input type="hidden" name="id" value={g?.id ?? ''} />
		<div class="field">
			<label for="goal-title-{g?.id ?? 'new'}">Ziel</label>
			<input
				id="goal-title-{g?.id ?? 'new'}"
				name="title"
				required
				maxlength="200"
				value={g?.title ?? ''}
				placeholder="z. B. In Mathe auf 11 Punkte kommen"
			/>
		</div>
		<div class="grid2">
			<div class="field">
				<label for="goal-subject-{g?.id ?? 'new'}">Fach</label>
				<select id="goal-subject-{g?.id ?? 'new'}" name="subjectId" value={g?.subjectId ?? ''}>
					<option value="">–</option>
					{#each data.subjects as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="goal-target-{g?.id ?? 'new'}">Zielpunkte (optional)</label>
				<input
					id="goal-target-{g?.id ?? 'new'}"
					name="targetPoints"
					type="number"
					min="0"
					max="15"
					value={g?.targetPoints ?? ''}
				/>
			</div>
			<div class="field">
				<label for="goal-due-{g?.id ?? 'new'}">Bis</label>
				<input id="goal-due-{g?.id ?? 'new'}" name="due" type="date" value={g?.due ?? ''} />
			</div>
		</div>
		<div class="actions">
			<button type="submit">{g ? 'Speichern' : 'Hinzufügen'}</button>
			{#if g}<button type="button" class="secondary" onclick={() => (editing = null)}
					>Abbrechen</button
				>{/if}
		</div>
	</form>
{/snippet}

{#snippet goal(g: PageData['goals'][number])}
	{@const s = subject(g.subjectId)}
	<article class="card goal" class:achieved={g.achieved}>
		{#if editing === g.id}
			{@render goalForm(g)}
		{:else}
			<div class="head">
				{#if s}<span class="dot" style:background={s.color}></span>{/if}
				<strong>{g.title}</strong>
				{#if g.achieved}<span class="tag good">erreicht</span>{/if}
			</div>
			<div class="muted small">
				{s?.name ?? ''}{g.due
					? `${s ? ' · ' : ''}bis ${new Date(g.due + 'T00:00').toLocaleDateString('de-DE')}`
					: ''}
			</div>
			{#if g.targetPoints !== null && s}
				{@const avg = s.average}
				<div class="progress" aria-label="Fortschritt">
					<div class="track">
						<div class="fill" style:width="{Math.min(100, ((avg ?? 0) / 15) * 100)}%"></div>
						<div
							class="target"
							style:left="{(g.targetPoints / 15) * 100}%"
							title="Ziel {g.targetPoints} Punkte"
						></div>
					</div>
					<span class="small">
						Schnitt {avg !== null ? fmt(avg) : '–'} / Ziel {g.targetPoints}
						{#if avg !== null && avg >= g.targetPoints}✓{/if}
					</span>
				</div>
			{/if}
			<div class="actions">
				<form method="POST" action="?/toggle" use:enhance>
					<input type="hidden" name="id" value={g.id} />
					<input type="hidden" name="achieved" value={String(!g.achieved)} />
					<button type="submit" class="secondary"
						>{g.achieved ? 'Doch nicht erreicht' : 'Erreicht ✓'}</button
					>
				</form>
				<button type="button" class="link" onclick={() => (editing = g.id)}>Bearbeiten</button>
				<form method="POST" action="?/delete" use:enhance>
					<input type="hidden" name="id" value={g.id} />
					<button type="submit" class="link">Löschen</button>
				</form>
			</div>
		{/if}
	</article>
{/snippet}

<style>
	h2 {
		font-size: 1.05rem;
		margin-top: 0;
	}
	.past-title {
		margin-top: 1.5rem;
	}
	.goals {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
	}
	.goal {
		display: grid;
		gap: 0.4rem;
	}
	.goal form {
		margin: 0;
	}
	.past .goal {
		opacity: 0.75;
	}
	.head {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.small {
		font-size: 0.85rem;
	}
	.tag.good {
		color: var(--accent);
		border-color: var(--accent);
	}
	.progress {
		display: grid;
		gap: 0.2rem;
	}
	.track {
		position: relative;
		height: 8px;
		border-radius: 4px;
		background: var(--bg);
		border: 1px solid var(--border);
	}
	.fill {
		height: 100%;
		border-radius: 4px;
		background: var(--accent);
	}
	.target {
		position: absolute;
		top: -3px;
		bottom: -3px;
		width: 2px;
		background: var(--text);
	}
</style>
