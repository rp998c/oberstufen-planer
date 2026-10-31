<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		EVENT_KINDS,
		REMINDER_PRESETS,
		daysUntil,
		formatEventDate,
		parseLocal,
		toLocalDate
	} from '$lib/calendar.ts';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type Ev = PageData['events'][number];
	let view = $state<'list' | 'month'>('list');
	let editing = $state<Ev | null>(null);
	let showForm = $state(false);
	let showPast = $state(false);
	const today = toLocalDate(new Date());
	let month = $state(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

	const subject = (id: string | null) => data.subjects.find((s) => s.id === id);
	const upcoming = $derived(data.events.filter((e) => (e.end ?? e.start).slice(0, 10) >= today));
	const past = $derived(
		data.events.filter((e) => (e.end ?? e.start).slice(0, 10) < today).reverse()
	);

	function edit(e: Ev | null) {
		editing = e;
		showForm = true;
	}
	const relative = (start: string) => {
		const d = daysUntil(start);
		return d === 0 ? 'heute' : d === 1 ? 'morgen' : d > 1 ? `in ${d} Tagen` : '';
	};

	// month grid (weeks start on Monday)
	const weeks = $derived.by(() => {
		const first = new Date(month);
		const offset = (first.getDay() + 6) % 7;
		const startDay = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
		const out: { date: string; inMonth: boolean; day: number }[][] = [];
		for (let w = 0; w < 6; w++) {
			const week = [];
			for (let d = 0; d < 7; d++) {
				const x = new Date(
					startDay.getFullYear(),
					startDay.getMonth(),
					startDay.getDate() + w * 7 + d
				);
				week.push({
					date: toLocalDate(x),
					inMonth: x.getMonth() === first.getMonth(),
					day: x.getDate()
				});
			}
			if (w === 5 && !week.some((d) => d.inMonth)) break;
			out.push(week);
		}
		return out;
	});
	const eventsOn = (date: string) =>
		data.events.filter(
			(e) => e.start.slice(0, 10) <= date && (e.end ?? e.start).slice(0, 10) >= date
		);
	const shiftMonth = (n: number) =>
		(month = new Date(month.getFullYear(), month.getMonth() + n, 1));
	let selectedDay = $state<string | null>(null);
</script>

<svelte:head><title>Kalender · Oberstufen-Planer</title></svelte:head>

<div class="actions head">
	<h1>Kalender</h1>
	<div class="seg" role="group" aria-label="Ansicht">
		<button type="button" class:on={view === 'list'} onclick={() => (view = 'list')}>Liste</button>
		<button type="button" class:on={view === 'month'} onclick={() => (view = 'month')}>Monat</button
		>
	</div>
	<button type="button" onclick={() => edit(null)}>+ Termin</button>
</div>

{#if form && 'error' in form && form.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form && 'imported' in form && form.imported}
	<p class="ok">
		{form.imported.created} Termine importiert, {form.imported.updated} aktualisiert.
	</p>
{/if}

{#if showForm}
	{#key editing?.id ?? 'new'}
		<form
			method="POST"
			action="?/save"
			class="card stack"
			use:enhance={() =>
				async ({ result, update }) => {
					await update();
					if (result.type === 'success') showForm = false;
				}}
		>
			<h2>{editing ? 'Termin bearbeiten' : 'Neuer Termin'}</h2>
			<input type="hidden" name="id" value={editing?.id ?? ''} />
			<div class="field">
				<label for="ev-title">Titel</label>
				<input id="ev-title" name="title" required maxlength="200" value={editing?.title ?? ''} />
			</div>
			<div class="grid2">
				<div class="field">
					<label for="ev-kind">Art</label>
					<select id="ev-kind" name="kind" value={editing?.kind ?? 'klausur'}>
						{#each Object.entries(EVENT_KINDS) as [value, label] (value)}<option {value}
								>{label}</option
							>{/each}
					</select>
				</div>
				<div class="field">
					<label for="ev-subject">Fach</label>
					<select id="ev-subject" name="subjectId" value={editing?.subjectId ?? ''}>
						<option value="">–</option>
						{#each data.subjects as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
					</select>
				</div>
				<div class="field">
					<label for="ev-date">Datum</label>
					<input
						id="ev-date"
						name="date"
						type="date"
						required
						value={editing?.start.slice(0, 10) ?? selectedDay ?? today}
					/>
				</div>
				<div class="field">
					<label for="ev-time">Uhrzeit (leer = ganztägig)</label>
					<input
						id="ev-time"
						name="time"
						type="time"
						value={editing && !editing.allDay ? editing.start.slice(11, 16) : ''}
					/>
				</div>
				<div class="field">
					<label for="ev-end">Bis (optional, mehrtägig)</label>
					<input id="ev-end" name="endDate" type="date" value={editing?.end?.slice(0, 10) ?? ''} />
				</div>
			</div>
			<fieldset>
				<legend>Erinnerungen</legend>
				{#each REMINDER_PRESETS as r (r.minutes)}
					<label class="inline">
						<input
							type="checkbox"
							name="reminders"
							value={r.minutes}
							checked={(editing?.reminders ?? data.defaultReminders).includes(r.minutes)}
						/>
						{r.label}
					</label>
				{/each}
			</fieldset>
			<div class="field">
				<label for="ev-note">Notiz</label>
				<textarea id="ev-note" name="note" maxlength="1000" rows="2">{editing?.note ?? ''}</textarea
				>
			</div>
			<div class="actions">
				<button type="submit">Speichern</button>
				<button type="button" class="secondary" onclick={() => (showForm = false)}>Abbrechen</button
				>
			</div>
		</form>
	{/key}
{/if}

{#if view === 'list'}
	<section class="card list">
		{#if upcoming.length === 0}
			<p class="muted empty">Keine anstehenden Termine.</p>
		{/if}
		{#each upcoming as e (e.id)}
			{@render eventRow(e)}
		{/each}
	</section>
	{#if past.length}
		<button type="button" class="link" onclick={() => (showPast = !showPast)}>
			{showPast ? 'Vergangene ausblenden' : `Vergangene Termine (${past.length})`}
		</button>
		{#if showPast}
			<section class="card list past">
				{#each past as e (e.id)}{@render eventRow(e)}{/each}
			</section>
		{/if}
	{/if}
{:else}
	<section class="card month">
		<div class="month-head">
			<button type="button" class="icon" aria-label="Voriger Monat" onclick={() => shiftMonth(-1)}
				>‹</button
			>
			<strong>{month.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</strong>
			<button type="button" class="icon" aria-label="Nächster Monat" onclick={() => shiftMonth(1)}
				>›</button
			>
		</div>
		<table>
			<thead
				><tr
					>{#each ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as d (d)}<th>{d}</th>{/each}</tr
				></thead
			>
			<tbody>
				{#each weeks as week, w (w)}
					<tr>
						{#each week as d (d.date)}
							{@const evs = eventsOn(d.date)}
							<td
								class:out={!d.inMonth}
								class:today={d.date === today}
								class:sel={d.date === selectedDay}
							>
								<button
									type="button"
									class="day"
									onclick={() => (selectedDay = d.date)}
									aria-label="{d.date}, {evs.length} Termine"
								>
									<span>{d.day}</span>
									<span class="dots">
										{#each evs.slice(0, 3) as e (e.id)}
											<span
												class="dot"
												style:background={subject(e.subjectId)?.color ?? 'var(--muted)'}
											></span>
										{/each}
									</span>
								</button>
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
	{#if selectedDay}
		<section class="card list">
			<h2 class="day-title">
				{parseLocal(selectedDay).toLocaleDateString('de-DE', {
					weekday: 'long',
					day: 'numeric',
					month: 'long'
				})}
			</h2>
			{#each eventsOn(selectedDay) as e (e.id)}{@render eventRow(e)}{:else}<p class="muted empty">
					Keine Termine.
				</p>{/each}
		</section>
	{/if}
{/if}

<details class="card import">
	<summary>Kalender importieren (.ics)</summary>
	<form method="POST" action="?/import" enctype="multipart/form-data" use:enhance class="stack">
		<p class="muted small">
			Z. B. den Schulkalender. Erneutes Importieren aktualisiert bereits importierte Termine.
		</p>
		<div class="field">
			<label for="ics-file">Datei</label>
			<input id="ics-file" name="file" type="file" accept=".ics,text/calendar" />
		</div>
		<div class="field">
			<label for="ics-url">oder Adresse (https:// oder webcal://)</label>
			<input
				id="ics-url"
				name="url"
				type="url"
				inputmode="url"
				placeholder="https://…/kalender.ics"
			/>
		</div>
		<div class="actions"><button type="submit">Importieren</button></div>
	</form>
</details>

{#snippet eventRow(e: Ev)}
	{@const s = subject(e.subjectId)}
	<div class="ev">
		<span class="bar" style:background={s?.color ?? 'var(--border)'}></span>
		<div class="ev-main">
			<div class="ev-title">
				<strong>{e.title}</strong>
				<span class="tag">{EVENT_KINDS[e.kind as keyof typeof EVENT_KINDS] ?? 'Termin'}</span>
				{#if s}<span class="muted small">{s.name}</span>{/if}
			</div>
			<div class="muted small">
				{formatEventDate(e.start, e.allDay)}{e.end ? ` – ${formatEventDate(e.end, true)}` : ''}
				{#if relative(e.start)}<strong class="rel">· {relative(e.start)}</strong>{/if}
				{#if e.reminders.length}<span title="Erinnerung aktiv"> · 🔔</span>{/if}
			</div>
			{#if e.note}<div class="small note">{e.note}</div>{/if}
		</div>
		<button type="button" class="icon" aria-label="Termin bearbeiten" onclick={() => edit(e)}
			>✎</button
		>
		<form
			method="POST"
			action="?/delete"
			use:enhance
			onsubmit={(ev) => {
				if (!confirm(`„${e.title}“ löschen?`)) ev.preventDefault();
			}}
		>
			<input type="hidden" name="id" value={e.id} />
			<button type="submit" class="icon" aria-label="Termin löschen">✕</button>
		</form>
	</div>
{/snippet}

<style>
	.head {
		justify-content: space-between;
	}
	.head h1 {
		margin: 0;
		flex: 1;
	}
	h2 {
		font-size: 1.05rem;
		margin: 0;
	}
	section,
	form.card,
	.import {
		margin-top: 1rem;
	}
	.ok {
		color: var(--accent);
	}
	.small {
		font-size: 0.85rem;
	}
	fieldset {
		border: 1px solid var(--border);
		border-radius: 8px;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
	}
	legend {
		font-weight: 600;
		padding: 0 0.3rem;
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
	.list {
		padding: 0;
	}
	.empty {
		padding: 1rem;
		margin: 0;
	}
	.past {
		opacity: 0.75;
	}
	.ev {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		padding: 0.7rem 0.75rem;
		border-bottom: 1px solid var(--border);
	}
	.ev:last-child {
		border-bottom: 0;
	}
	.ev form {
		margin: 0;
	}
	.bar {
		width: 4px;
		align-self: stretch;
		border-radius: 2px;
		flex: none;
	}
	.ev-main {
		flex: 1;
		min-width: 0;
	}
	.ev-title {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.rel {
		color: var(--text);
		font-weight: 600;
	}
	.note {
		white-space: pre-line;
		margin-top: 0.2rem;
	}
	.icon {
		background: none;
		color: var(--muted);
		padding: 0.35rem 0.5rem;
		font-size: 1.05rem;
		line-height: 1;
	}
	.month {
		padding: 0.5rem;
	}
	.month-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.25rem;
	}
	.month table {
		table-layout: fixed;
	}
	.month th {
		text-align: center;
		font-weight: 500;
		color: var(--muted);
		font-size: 0.8rem;
		border: 0;
	}
	.month td {
		padding: 1px;
		border: 0;
	}
	.day {
		width: 100%;
		min-height: 2.9rem;
		background: none;
		color: var(--text);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		padding: 0.3rem 0;
		font-weight: 500;
	}
	td.out .day {
		color: var(--muted);
		opacity: 0.5;
	}
	td.today .day {
		box-shadow: inset 0 0 0 2px var(--accent);
	}
	td.sel .day {
		background: color-mix(in srgb, var(--accent) 15%, transparent);
	}
	.dots {
		display: flex;
		gap: 2px;
		min-height: 0.5rem;
	}
	.dots .dot {
		width: 0.4rem;
		height: 0.4rem;
	}
	.day-title {
		padding: 0.75rem 0.75rem 0;
	}
	.import summary {
		cursor: pointer;
		font-weight: 600;
	}
	.import form {
		margin-top: 0.75rem;
	}
</style>
