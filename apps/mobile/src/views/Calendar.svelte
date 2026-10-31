<script lang="ts">
	import {
		EVENT_KINDS,
		OpError,
		REMINDER_PRESETS,
		daysUntil,
		formatEventDate,
		toLocalDate,
		type EventRow
	} from '@oberstufen-planer/app-core';
	import { app } from '../lib/app.svelte.ts';
	import { nav } from '../lib/nav.svelte.ts';
	import { notificationPermission, requestNotificationPermission } from '../lib/notifications.ts';

	const today = toLocalDate(new Date());
	let editing = $state<EventRow | 'new' | null>(null);
	let showPast = $state(false);
	let error = $state('');
	let permission = $state<'granted' | 'denied' | 'prompt'>('granted');
	$effect(() => {
		void notificationPermission().then((p) => (permission = p));
	});

	// form
	let title = $state('');
	let kind = $state('klausur');
	let subjectId = $state('');
	let date = $state(today);
	let time = $state('');
	let endDate = $state('');
	let reminders = $state<number[]>([]);
	let note = $state('');

	const subjects = $derived(app.courses.map((c) => c.subject));
	const subject = (id: string | null) => subjects.find((s) => s.id === id);
	const sorted = $derived(
		[...app.snapshot.data.events].sort((a, b) => a.start.localeCompare(b.start))
	);
	const upcoming = $derived(sorted.filter((e) => (e.end ?? e.start).slice(0, 10) >= today));
	const past = $derived(sorted.filter((e) => (e.end ?? e.start).slice(0, 10) < today).reverse());

	function edit(e: EventRow | 'new') {
		editing = e;
		error = '';
		const ev = e === 'new' ? null : e;
		title = ev?.title ?? '';
		kind = ev?.kind ?? 'klausur';
		subjectId = ev?.subjectId ?? '';
		date = ev?.start.slice(0, 10) ?? today;
		time = ev && !ev.allDay ? ev.start.slice(11, 16) : '';
		endDate = ev?.end ?? '';
		reminders = ev ? [...ev.reminders] : [...(app.snapshot.settings.reminderDefaults ?? [1440])];
		note = ev?.note ?? '';
		window.scrollTo(0, 0);
	}

	$effect(() => {
		if (!editing) return;
		return nav.onBack(() => (editing = null));
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		if (!date) {
			error = 'Bitte ein Datum wählen.';
			return;
		}
		try {
			app.mutate({
				type: 'event.upsert',
				event: {
					id: editing === 'new' || !editing ? app.newId() : editing.id,
					subjectId: subjectId || null,
					title: title.trim(),
					kind,
					start: time ? `${date}T${time}` : date,
					end: endDate && endDate > date ? endDate : null,
					allDay: !time,
					note: note.trim(),
					reminders
				}
			});
			editing = null;
			if (reminders.length && permission !== 'granted') {
				permission = (await requestNotificationPermission()) ? 'granted' : 'denied';
			}
		} catch (err) {
			error = err instanceof OpError ? err.message : String(err);
		}
	}

	function remove(e: EventRow) {
		if (confirm(`„${e.title}“ löschen?`)) app.mutate({ type: 'event.delete', id: e.id });
	}

	const relative = (start: string) => {
		const d = daysUntil(start);
		return d === 0 ? 'heute' : d === 1 ? 'morgen' : d > 1 ? `in ${d} Tagen` : '';
	};
</script>

{#if editing}
	<p><button class="link" onclick={() => (editing = null)}>← Kalender</button></p>
	<form class="card stack" onsubmit={submit}>
		<h2>{editing === 'new' ? 'Neuer Termin' : 'Termin bearbeiten'}</h2>
		<div class="field">
			<label for="e-title">Titel</label>
			<input id="e-title" bind:value={title} required maxlength="200" />
		</div>
		<div class="grid2">
			<div class="field">
				<label for="e-kind">Art</label>
				<select id="e-kind" bind:value={kind}>
					{#each Object.entries(EVENT_KINDS) as [value, label] (value)}<option {value}
							>{label}</option
						>{/each}
				</select>
			</div>
			<div class="field">
				<label for="e-subject">Fach</label>
				<select id="e-subject" bind:value={subjectId}>
					<option value="">–</option>
					{#each subjects as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="e-date">Datum</label>
				<input id="e-date" type="date" bind:value={date} required />
			</div>
			<div class="field">
				<label for="e-time">Uhrzeit (leer = ganztägig)</label>
				<input id="e-time" type="time" bind:value={time} />
			</div>
			<div class="field">
				<label for="e-end">Bis (mehrtägig)</label>
				<input id="e-end" type="date" bind:value={endDate} />
			</div>
		</div>
		<fieldset>
			<legend>Erinnerungen</legend>
			{#each REMINDER_PRESETS as r (r.minutes)}
				<label class="inline"
					><input type="checkbox" value={r.minutes} bind:group={reminders} /> {r.label}</label
				>
			{/each}
		</fieldset>
		<div class="field">
			<label for="e-note">Notiz</label>
			<textarea id="e-note" bind:value={note} rows="2" maxlength="1000"></textarea>
		</div>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<button type="submit">Speichern</button>
	</form>
{:else}
	<div class="head">
		<h1>Kalender</h1>
		<button onclick={() => edit('new')}>+ Termin</button>
	</div>
	{#if permission === 'denied'}
		<p class="banner">
			Benachrichtigungen sind für die App ausgeschaltet – Erinnerungen erscheinen erst, wenn du sie
			in den Android-Einstellungen erlaubst.
		</p>
	{/if}
	<section class="card list-card">
		{#each upcoming as e (e.id)}{@render row(e)}{:else}<p class="row muted">
				Keine anstehenden Termine.
			</p>{/each}
	</section>
	{#if past.length}
		<button class="link" onclick={() => (showPast = !showPast)}
			>{showPast ? 'Vergangene ausblenden' : `Vergangene (${past.length})`}</button
		>
		{#if showPast}<section class="card list-card past">
				{#each past as e (e.id)}{@render row(e)}{/each}
			</section>{/if}
	{/if}
{/if}

{#snippet row(e: EventRow)}
	{@const s = subject(e.subjectId)}
	<div class="row">
		<span class="bar" style:background={s?.color ?? 'var(--border)'}></span>
		<button class="grow open" onclick={() => edit(e)}>
			<strong>{e.title}</strong>
			<span class="tag">{EVENT_KINDS[e.kind as keyof typeof EVENT_KINDS] ?? 'Termin'}</span><br />
			<small class="muted">
				{formatEventDate(e.start, e.allDay)}{e.end ? ` – ${formatEventDate(e.end, true)}` : ''}{s
					? ` · ${s.name}`
					: ''}
				{#if relative(e.start)}<strong> · {relative(e.start)}</strong>{/if}
				{#if e.reminders.length}
					· 🔔{/if}
			</small>
		</button>
		<button class="icon-btn" aria-label="Termin löschen" onclick={() => remove(e)}>✕</button>
	</div>
{/snippet}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.head h1 {
		margin: 0.5rem 0 1rem;
	}
	.bar {
		width: 4px;
		align-self: stretch;
		border-radius: 2px;
	}
	.open {
		background: none;
		color: var(--text);
		text-align: left;
		padding: 0;
		font-weight: 400;
	}
	.past {
		opacity: 0.75;
	}
	fieldset {
		border: 1px solid var(--border);
		border-radius: 8px;
		display: grid;
		gap: 0.35rem;
	}
	legend {
		font-weight: 600;
	}
	p.row {
		margin: 0;
	}
</style>
