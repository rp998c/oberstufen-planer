<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
	const days = $derived(DAYS.slice(0, data.config.saturday ? 6 : 5));
	const periods = $derived(Array.from({ length: data.config.periods }, (_, i) => i + 1));
	const slotAt = (d: number, p: number) =>
		data.slots.find((s) => s.weekday === d && s.period === p);
	const subject = (id: string) => data.subjects.find((s) => s.id === id);
	const todayIdx = ((new Date().getDay() + 6) % 7) + 1;

	let selected = $state<{ weekday: number; period: number } | null>(null);
	const current = $derived(selected ? slotAt(selected.weekday, selected.period) : undefined);
	const short = (name: string) => (name.length > 6 ? name.slice(0, 5) + '.' : name);
</script>

<svelte:head><title>Stundenplan · Oberstufen-Planer</title></svelte:head>

<p><a href="/mehr">← Mehr</a></p>
<h1>Stundenplan</h1>
<p class="muted">Tippe auf eine Stunde, um ein Fach einzutragen.</p>

<section class="card grid-card">
	<table>
		<thead>
			<tr>
				<th></th>
				{#each days as d, i (d)}<th class:today={i + 1 === todayIdx}>{d}</th>{/each}
			</tr>
		</thead>
		<tbody>
			{#each periods as p (p)}
				<tr>
					<th scope="row" class="period">{p}</th>
					{#each days as _, i (i)}
						{@const slot = slotAt(i + 1, p)}
						{@const s = slot ? subject(slot.subjectId) : undefined}
						<td>
							<button
								type="button"
								class="cell"
								class:filled={!!s}
								class:sel={selected?.weekday === i + 1 && selected?.period === p}
								style:--c={s?.color ?? 'transparent'}
								aria-label="{DAYS[i]} {p}. Stunde{s ? `: ${s.name}` : ''}"
								onclick={() => (selected = { weekday: i + 1, period: p })}
							>
								{#if s}
									<span class="name">{short(s.name)}</span>
									{#if slot?.room}<span class="room">{slot.room}</span>{/if}
								{/if}
							</button>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</section>

{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

{#if selected}
	{#key `${selected.weekday}-${selected.period}`}
		<form
			method="POST"
			action="?/slot"
			use:enhance={() =>
				async ({ update, result }) => {
					await update({ reset: false });
					if (result.type === 'success') selected = null;
				}}
			class="card stack editor"
		>
			<h2>{DAYS[selected.weekday - 1]}, {selected.period}. Stunde</h2>
			<input type="hidden" name="weekday" value={selected.weekday} />
			<input type="hidden" name="period" value={selected.period} />
			<div class="grid2">
				<div class="field">
					<label for="slot-subject">Fach</label>
					<select id="slot-subject" name="subjectId" value={current?.subjectId ?? ''}>
						<option value="">– frei –</option>
						{#each data.subjects as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
					</select>
				</div>
				<div class="field">
					<label for="slot-room">Raum</label>
					<input id="slot-room" name="room" maxlength="20" value={current?.room ?? ''} />
				</div>
			</div>
			<div class="actions">
				<button type="submit">Speichern</button>
				<button type="button" class="secondary" onclick={() => (selected = null)}>Abbrechen</button>
			</div>
		</form>
	{/key}
{/if}

<details class="card settings">
	<summary>Einstellungen</summary>
	<form method="POST" action="?/config" use:enhance class="actions">
		<label for="periods">Stunden pro Tag</label>
		<input
			id="periods"
			name="periods"
			type="number"
			min="4"
			max="14"
			value={data.config.periods}
			class="narrow"
		/>
		<label class="inline"
			><input type="checkbox" name="saturday" checked={data.config.saturday} /> Samstag</label
		>
		<button type="submit" class="secondary">Übernehmen</button>
	</form>
</details>

<style>
	h2 {
		font-size: 1.05rem;
		margin: 0;
	}
	.grid-card {
		padding: 0.4rem;
	}
	table {
		table-layout: fixed;
	}
	th,
	td {
		padding: 1px;
		border: 0;
		text-align: center;
	}
	thead th {
		font-weight: 600;
		color: var(--muted);
		font-size: 0.85rem;
		padding-bottom: 0.3rem;
	}
	thead th.today {
		color: var(--accent);
	}
	.period {
		width: 1.6rem;
		color: var(--muted);
		font-weight: 500;
		font-size: 0.85rem;
	}
	.cell {
		width: 100%;
		min-height: 2.6rem;
		padding: 0.15rem;
		border-radius: 6px;
		background: var(--bg);
		color: var(--text);
		border: 1px dashed var(--border);
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.15;
		overflow: hidden;
	}
	.cell.filled {
		border: 1px solid transparent;
		border-left: 4px solid var(--c);
		background: color-mix(in srgb, var(--c) 14%, var(--surface));
	}
	.cell.sel {
		box-shadow: 0 0 0 2px var(--accent);
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.room {
		font-weight: 400;
		color: var(--muted);
		font-size: 0.7rem;
	}
	.editor,
	.settings {
		margin-top: 1rem;
	}
	.settings summary {
		cursor: pointer;
		font-weight: 600;
	}
	.settings form {
		margin-top: 0.75rem;
	}
	.narrow {
		max-width: 5rem;
	}
	.inline {
		font-weight: 400;
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}
	.inline input {
		width: auto;
	}
</style>
