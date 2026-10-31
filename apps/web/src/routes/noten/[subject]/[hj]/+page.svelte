<script lang="ts">
	import { enhance } from '$app/forms';
	import { HALF_YEAR_LABELS } from '$lib/subjects.ts';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let open = $state(false);
	let editing = $state<string | null>(null);

	const typeName = (id: string) => data.gradeTypes.find((t) => t.id === id)?.name ?? '?';
	const fmt = (x: number) => x.toFixed(2).replace('.', ',');
	const fmtDate = (d: string | null) =>
		d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE') : '';
	const today = new Date().toISOString().slice(0, 10);

	const sourceText = $derived(
		{
			zeugnis: 'Zeugnisnote',
			prognose: 'deine Prognose',
			noten: 'aus deinen Noten',
			offen: 'noch offen – es wird dein Durchschnitt angenommen'
		}[data.course.source]
	);
</script>

<svelte:head><title>{data.subject.name} {data.halfYear}. HJ · Oberstufen-Planer</title></svelte:head
>

<p><a href="/noten">← Noten</a></p>
<h1>
	<span class="dot" style:background={data.subject.color}></span>
	{data.subject.name} · {HALF_YEAR_LABELS[data.halfYear]}
</h1>

<section class="card summary">
	<div>
		<div class="big">{data.course.effective ?? '–'}</div>
		<div class="muted">Punkte · {sourceText}</div>
	</div>
	{#if data.course.fromGrades}
		<div>
			<div class="mid">{fmt(data.course.fromGrades.exact)}</div>
			<div class="muted">Schnitt deiner Noten</div>
		</div>
	{/if}
	{#if data.course.openCount && data.course.fromGradesProjected}
		<div>
			<div class="mid">{fmt(data.course.fromGradesProjected.exact)}</div>
			<div class="muted">mit offenen Noten</div>
		</div>
	{/if}
</section>

{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

<section class="card">
	<h2>Noten</h2>
	{#if data.grades.length === 0}
		<p class="muted">Noch keine Noten in diesem Halbjahr.</p>
	{:else}
		<ul class="grades">
			{#each data.grades as g (g.id)}
				<li>
					{#if editing === g.id}
						<form
							method="POST"
							action="?/updateGrade"
							use:enhance={() =>
								async ({ result, update }) => {
									await update();
									if (result.type === 'success') editing = null;
								}}
							class="stack"
						>
							<input type="hidden" name="id" value={g.id} />
							{@render gradeFields(g.points === null, g)}
							<div class="actions">
								<button type="submit">Speichern</button>
								<button type="button" class="secondary" onclick={() => (editing = null)}
									>Abbrechen</button
								>
							</div>
						</form>
					{:else}
						<div class="grade">
							<span class="pts" class:open={g.points === null}>
								{g.points ?? (g.forecast !== null ? `≈${g.forecast}` : '?')}
							</span>
							<span class="info">
								<strong>{typeName(g.gradeTypeId)}</strong>
								{#if g.weight !== 1}<span class="tag">×{String(g.weight).replace('.', ',')}</span
									>{/if}
								{#if g.points === null}<span class="tag">offen</span>{/if}
								<small class="muted">{fmtDate(g.date)} {g.note}</small>
							</span>
							<button
								class="icon"
								type="button"
								aria-label="Note bearbeiten"
								title="Bearbeiten"
								onclick={() => (editing = g.id)}>✎</button
							>
							<form method="POST" action="?/deleteGrade" use:enhance>
								<input type="hidden" name="id" value={g.id} />
								<button class="icon" type="submit" aria-label="Note löschen" title="Löschen"
									>✕</button
								>
							</form>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section class="card">
	<h2>Neue Note</h2>
	<form
		method="POST"
		action="?/addGrade"
		class="stack"
		use:enhance={() =>
			async ({ result, update }) => {
				await update({ reset: result.type === 'success' });
				if (result.type === 'success') open = false;
			}}
	>
		{@render gradeFields(open)}
		<div class="actions"><button type="submit">Hinzufügen</button></div>
	</form>
</section>

<section class="card">
	<h2>Halbjahresnote</h2>
	<form method="POST" action="?/course" use:enhance class="stack">
		<div class="grid2">
			<div class="field">
				<label for="points">Zeugnisnote (Punkte)</label>
				<input
					id="points"
					name="points"
					type="number"
					min="0"
					max="15"
					inputmode="numeric"
					value={data.course.points ?? ''}
				/>
			</div>
			<div class="field">
				<label for="forecast">Eigene Prognose (Punkte)</label>
				<input
					id="forecast"
					name="forecast"
					type="number"
					min="0"
					max="15"
					inputmode="numeric"
					value={data.course.forecast ?? ''}
				/>
			</div>
		</div>
		<p class="muted small">
			Die Zeugnisnote ist verbindlich. Solange sie fehlt, zählt deine Prognose, sonst der Schnitt
			aus deinen Noten.
		</p>
		<div class="actions"><button type="submit">Speichern</button></div>
	</form>
</section>

{#snippet gradeFields(isOpen: boolean, g?: PageData['grades'][number])}
	<div class="grid2">
		<div class="field">
			<label for="type-{g?.id ?? 'new'}">Art</label>
			<select id="type-{g?.id ?? 'new'}" name="gradeTypeId" required>
				{#each data.gradeTypes as t (t.id)}
					<option value={t.id} selected={g ? g.gradeTypeId === t.id : undefined}>{t.name}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="date-{g?.id ?? 'new'}">Datum</label>
			<input
				id="date-{g?.id ?? 'new'}"
				name="date"
				type="date"
				defaultValue={g ? (g.date ?? '') : today}
			/>
		</div>
	</div>
	<label class="inline">
		<input
			type="checkbox"
			name="open"
			checked={isOpen}
			onchange={(e) => {
				if (!g) open = e.currentTarget.checked;
			}}
		/>
		Noch offen (angekündigt, Ergebnis fehlt)
	</label>
	<div class="grid2">
		<div class="field">
			<label for="pts-{g?.id ?? 'new'}"
				>{g
					? 'Punkte (bei „offen“: erwartete Punkte)'
					: isOpen
						? 'Erwartete Punkte (optional)'
						: 'Punkte'}</label
			>
			<input
				id="pts-{g?.id ?? 'new'}"
				name="value"
				type="number"
				min="0"
				max="15"
				inputmode="numeric"
				defaultValue={g ? (g.points ?? g.forecast ?? '') : ''}
			/>
		</div>
		<div class="field">
			<label for="w-{g?.id ?? 'new'}">Gewicht</label>
			<input
				id="w-{g?.id ?? 'new'}"
				name="weight"
				type="number"
				min="0.1"
				max="10"
				step="0.1"
				defaultValue={g?.weight ?? 1}
			/>
		</div>
	</div>
	<div class="field">
		<label for="note-{g?.id ?? 'new'}">Notiz</label>
		<input id="note-{g?.id ?? 'new'}" name="note" maxlength="200" defaultValue={g?.note ?? ''} />
	</div>
{/snippet}

<style>
	h1 {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	h2 {
		font-size: 1.05rem;
		margin-top: 0;
	}
	section {
		margin-top: 1rem;
	}
	.summary {
		display: flex;
		gap: 2rem;
		flex-wrap: wrap;
		align-items: flex-end;
	}
	.big {
		font-size: 2.5rem;
		font-weight: 700;
		line-height: 1;
	}
	.mid {
		font-size: 1.4rem;
		font-weight: 600;
	}
	.grades {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.grades li {
		border-bottom: 1px solid var(--border);
		padding: 0.5rem 0;
	}
	.grades li:last-child {
		border-bottom: 0;
	}
	.grade {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}
	.grade form {
		margin: 0;
	}
	.icon {
		background: none;
		color: var(--muted);
		padding: 0.4rem 0.55rem;
		font-size: 1.05rem;
		line-height: 1;
	}
	.pts {
		font-size: 1.3rem;
		font-weight: 700;
		min-width: 2.5rem;
		text-align: center;
	}
	.pts.open {
		color: var(--muted);
		font-style: italic;
	}
	.info {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.5rem;
		align-items: center;
	}
	.info small {
		flex-basis: 100%;
	}
	.inline {
		font-weight: 400;
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.inline input {
		width: auto;
	}
	.small {
		font-size: 0.85rem;
		margin: 0;
	}
</style>
