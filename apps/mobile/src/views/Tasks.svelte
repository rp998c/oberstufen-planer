<script lang="ts">
	import { OpError, daysUntil, type TaskRow } from '@oberstufen-planer/app-core';
	import { app } from '../lib/app.svelte.ts';

	let title = $state('');
	let due = $state('');
	let subjectId = $state('');
	let error = $state('');

	const subjects = $derived(app.courses.map((c) => c.subject));
	const sorted = $derived(
		[...app.snapshot.data.tasks].sort(
			(a, b) =>
				Number(a.done) - Number(b.done) ||
				(a.due ?? '9999').localeCompare(b.due ?? '9999') ||
				a.createdAt - b.createdAt
		)
	);
	const open = $derived(sorted.filter((t) => !t.done));
	const done = $derived(sorted.filter((t) => t.done));

	function add(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		try {
			app.mutate({
				type: 'task.upsert',
				task: {
					id: app.newId(),
					subjectId: subjectId || null,
					title: title.trim(),
					due: due || null,
					done: false,
					createdAt: Date.now()
				}
			});
			title = '';
			due = '';
		} catch (err) {
			error = err instanceof OpError ? err.message : String(err);
		}
	}
	const toggle = (t: TaskRow) => app.mutate({ type: 'task.upsert', task: { ...t, done: !t.done } });
	const remove = (t: TaskRow) => app.mutate({ type: 'task.delete', id: t.id });
	const dueText = (d: string) => {
		const n = daysUntil(d);
		return n < 0
			? 'überfällig'
			: n === 0
				? 'heute'
				: n === 1
					? 'morgen'
					: new Date(d + 'T00:00').toLocaleDateString('de-DE', {
							day: '2-digit',
							month: '2-digit'
						});
	};
</script>

<h1>Aufgaben</h1>
<form class="card stack" onsubmit={add}>
	<input
		bind:value={title}
		placeholder="Neue Aufgabe"
		required
		maxlength="200"
		aria-label="Neue Aufgabe"
	/>
	<div class="grid2">
		<select bind:value={subjectId} aria-label="Fach">
			<option value="">Kein Fach</option>
			{#each subjects as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
		</select>
		<input type="date" bind:value={due} aria-label="Fällig am" />
	</div>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<button type="submit">Hinzufügen</button>
</form>

<section class="card list-card">
	{#each open as t (t.id)}{@render row(t)}{:else}<p class="row muted">Nichts zu tun. 🎉</p>{/each}
</section>
{#if done.length}
	<h2 class="done-title">Erledigt</h2>
	<section class="card list-card done">
		{#each done as t (t.id)}{@render row(t)}{/each}
	</section>
{/if}

{#snippet row(t: TaskRow)}
	{@const s = subjects.find((x) => x.id === t.subjectId)}
	<div class="row">
		<button
			class="check"
			class:on={t.done}
			aria-label={t.done ? 'Als offen markieren' : 'Als erledigt markieren'}
			onclick={() => toggle(t)}>{t.done ? '✓' : ''}</button
		>
		<span class="grow">
			<span class="title">{t.title}</span><br />
			<small class="muted"
				>{s?.name ?? ''}{t.due && !t.done ? `${s ? ' · ' : ''}${dueText(t.due)}` : ''}</small
			>
		</span>
		<button class="icon-btn" aria-label="Aufgabe löschen" onclick={() => remove(t)}>✕</button>
	</div>
{/snippet}

<style>
	.check {
		width: 1.7rem;
		height: 1.7rem;
		padding: 0;
		border-radius: 50%;
		background: transparent;
		border: 2px solid var(--border);
		color: var(--accent-text);
	}
	.check.on {
		background: var(--accent);
		border-color: var(--accent);
	}
	.done .title {
		text-decoration: line-through;
		color: var(--muted);
	}
	.done-title {
		margin-top: 1.25rem;
	}
	p.row {
		margin: 0;
	}
</style>
