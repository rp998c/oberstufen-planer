<script lang="ts">
	import {
		EVENT_KINDS,
		OpError,
		REMINDER_PRESETS,
		sortedSubjects,
		todayLocal,
		type CalEvent,
		type EventKind
	} from '@oberstufen-planer/app-core';
	import { newId, store } from '../lib/store.svelte.ts';
	import Sheet from './Sheet.svelte';

	let {
		onclose,
		event = null,
		date = null
	}: { onclose: () => void; event?: CalEvent | null; date?: string | null } = $props();

	const subjects = $derived(sortedSubjects(store.data.subjects));
	// svelte-ignore state_referenced_locally
	const e0 = event;
	let subjectId = $state(e0?.subjectId ?? '');
	let kind = $state<EventKind>(e0?.kind ?? 'klausur');
	let title = $state(e0?.title ?? '');
	// svelte-ignore state_referenced_locally
	let day = $state(e0?.start.slice(0, 10) ?? date ?? todayLocal());
	let time = $state(e0 && !e0.allDay ? e0.start.slice(11, 16) : '');
	let reminders = $state<number[]>(e0?.reminders ?? [1440]);
	let note = $state(e0?.note ?? '');
	let error = $state('');

	const autoTitle = $derived(subjects.find((s) => s.id === subjectId)?.name ?? EVENT_KINDS[kind]);

	function toggle(m: number) {
		reminders = reminders.includes(m)
			? reminders.filter((x) => x !== m)
			: [...reminders, m].sort((a, b) => b - a);
	}

	function save(ev: Event) {
		ev.preventDefault();
		error = '';
		const t = title.trim() || autoTitle;
		const allDay = !time;
		try {
			store.mutate({
				type: 'event.upsert',
				event: {
					id: e0?.id ?? newId(),
					subjectId: subjectId || null,
					title: t,
					kind,
					start: allDay ? day : `${day}T${time}`,
					end: null,
					allDay,
					note: note.trim(),
					reminders: allDay
						? reminders.filter((m) => m !== 60)
						: reminders.filter((m) => m !== 360),
					externalUid: e0?.externalUid ?? null
				}
			});
			onclose();
		} catch (err) {
			error = err instanceof OpError ? err.message : String(err);
		}
	}
	function remove() {
		if (!e0 || !confirm('Diesen Termin löschen?')) return;
		store.mutate({ type: 'event.delete', id: e0.id });
		onclose();
	}
</script>

<Sheet title={e0 ? 'Termin bearbeiten' : 'Neuer Termin'} {onclose} width={460}>
	<form class="form" onsubmit={save}>
		<div class="row2">
			<label class="field">
				<span>Fach</span>
				<select class="input" bind:value={subjectId}>
					<option value="">– kein Fach –</option>
					{#each subjects as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
				</select>
			</label>
			<label class="field">
				<span>Art</span>
				<select class="input" bind:value={kind}>
					{#each Object.entries(EVENT_KINDS) as [k, l] (k)}<option value={k}>{l}</option>{/each}
				</select>
			</label>
		</div>
		<label class="field"
			><span>Titel</span><input
				class="input"
				maxlength="200"
				bind:value={title}
				placeholder={autoTitle}
			/></label
		>
		<div class="row2">
			<label class="field"
				><span>Datum</span><input class="input" type="date" required bind:value={day} /></label
			>
			<label class="field"
				><span>Uhrzeit (optional)</span><input class="input" type="time" bind:value={time} /></label
			>
		</div>
		<fieldset class="rem">
			<legend class="small">Erinnerung</legend>
			{#each REMINDER_PRESETS.filter( (p) => (time ? p.minutes !== 360 : p.minutes !== 60) ) as p (p.minutes)}
				<label class="check"
					><input
						type="checkbox"
						checked={reminders.includes(p.minutes)}
						onchange={() => toggle(p.minutes)}
					/>{p.label.replace(' (ganztägig)', '')}</label
				>
			{/each}
		</fieldset>
		<label class="field"
			><span>Notiz</span><input
				class="input"
				maxlength="1000"
				bind:value={note}
				placeholder="optional"
			/></label
		>
		{#if error}<p class="error-text" role="alert">{error}</p>{/if}
		<div class="btns">
			{#if e0}<button type="button" class="btn danger" onclick={remove}>Löschen</button>{/if}
			<button class="btn accent big" type="submit">Speichern</button>
		</div>
	</form>
</Sheet>

<style>
	.form {
		display: grid;
		gap: 14px;
	}
	.row2 {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 10px;
	}
	.rem {
		border: 0;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 10px 18px;
	}
	.rem legend {
		font-weight: 500;
		color: var(--text2);
		margin-bottom: 8px;
		padding: 0;
	}
	.btns {
		display: flex;
		gap: 10px;
	}
	.btns .accent {
		flex: 1;
	}
</style>
