<script lang="ts">
	import { enhance } from '$app/forms';
	import { daysUntil } from '$lib/calendar.ts';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const subject = (id: string | null) => data.subjects.find((s) => s.id === id);
	const open = $derived(data.tasks.filter((t) => !t.done));
	const done = $derived(data.tasks.filter((t) => t.done));
	const dueText = (due: string | null) => {
		if (!due) return '';
		const d = daysUntil(due);
		if (d < 0) return `überfällig (${new Date(due + 'T00:00').toLocaleDateString('de-DE')})`;
		if (d === 0) return 'heute';
		if (d === 1) return 'morgen';
		return `bis ${new Date(due + 'T00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}`;
	};
</script>

<svelte:head><title>Aufgaben · Oberstufen-Planer</title></svelte:head>

<p><a href="/mehr">← Mehr</a></p>
<h1>Aufgaben</h1>

<form
	method="POST"
	action="?/add"
	use:enhance={() =>
		async ({ update }) =>
			update({ reset: true })}
	class="card stack"
>
	<div class="field">
		<label for="task-title">Neue Aufgabe</label>
		<input
			id="task-title"
			name="title"
			required
			maxlength="200"
			placeholder="z. B. Referat vorbereiten"
		/>
	</div>
	<div class="grid2">
		<div class="field">
			<label for="task-subject">Fach</label>
			<select id="task-subject" name="subjectId">
				<option value="">–</option>
				{#each data.subjects as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
			</select>
		</div>
		<div class="field">
			<label for="task-due">Fällig</label>
			<input id="task-due" name="due" type="date" />
		</div>
	</div>
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	<div class="actions"><button type="submit">Hinzufügen</button></div>
</form>

<section class="card list">
	{#each open as t (t.id)}{@render task(t)}{:else}<p class="muted empty">
			Nichts zu tun. 🎉
		</p>{/each}
</section>

{#if done.length}
	<h2>Erledigt</h2>
	<section class="card list done">
		{#each done as t (t.id)}{@render task(t)}{/each}
	</section>
	<form method="POST" action="?/clearDone" use:enhance>
		<button type="submit" class="link">Erledigte löschen</button>
	</form>
{/if}

{#snippet task(t: PageData['tasks'][number])}
	{@const s = subject(t.subjectId)}
	<div class="task">
		<form method="POST" action="?/toggle" use:enhance>
			<input type="hidden" name="id" value={t.id} />
			<input type="hidden" name="done" value={String(!t.done)} />
			<button
				type="submit"
				class="check"
				class:on={t.done}
				aria-label={t.done ? 'Als offen markieren' : 'Als erledigt markieren'}
			>
				{t.done ? '✓' : ''}
			</button>
		</form>
		<div class="main">
			<span class="title">{t.title}</span>
			<small class="muted">
				{#if s}<span class="dot" style:background={s.color}></span> {s.name}{/if}
				{#if t.due && !t.done}<span class:late={daysUntil(t.due) < 0}
						>{s ? ' · ' : ''}{dueText(t.due)}</span
					>{/if}
			</small>
		</div>
		<form method="POST" action="?/delete" use:enhance>
			<input type="hidden" name="id" value={t.id} />
			<button type="submit" class="icon" aria-label="Aufgabe löschen">✕</button>
		</form>
	</div>
{/snippet}

<style>
	h2 {
		font-size: 1.05rem;
		margin: 1.25rem 0 0.5rem;
	}
	section {
		margin-top: 1rem;
	}
	.list {
		padding: 0;
	}
	.empty {
		padding: 1rem;
		margin: 0;
	}
	.task {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		padding: 0.55rem 0.75rem;
		border-bottom: 1px solid var(--border);
	}
	.task:last-child {
		border-bottom: 0;
	}
	.task form {
		margin: 0;
	}
	.check {
		width: 1.6rem;
		height: 1.6rem;
		padding: 0;
		border-radius: 50%;
		background: transparent;
		border: 2px solid var(--border);
		color: var(--accent-text);
		font-size: 0.85rem;
	}
	.check.on {
		background: var(--accent);
		border-color: var(--accent);
	}
	.main {
		flex: 1;
		min-width: 0;
		display: grid;
	}
	.done .title {
		text-decoration: line-through;
		color: var(--muted);
	}
	.late {
		color: var(--danger);
		font-weight: 600;
	}
	.icon {
		background: none;
		color: var(--muted);
		padding: 0.35rem 0.5rem;
	}
	.dot {
		width: 0.55rem;
		height: 0.55rem;
	}
</style>
