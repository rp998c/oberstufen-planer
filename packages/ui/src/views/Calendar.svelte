<script lang="ts">
	import { EVENT_KINDS, parseLocal, toLocalDate, type CalEvent } from '@oberstufen-planer/app-core';
	import EventSheet from '../components/EventSheet.svelte';
	import Icon from '../components/Icon.svelte';
	import { timeOf } from '../lib/format.ts';
	import { store } from '../lib/store.svelte.ts';
	import { ui } from '../lib/ui.svelte.ts';

	const MONTHS = [
		'Januar',
		'Februar',
		'März',
		'April',
		'Mai',
		'Juni',
		'Juli',
		'August',
		'September',
		'Oktober',
		'November',
		'Dezember'
	];
	const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
	const DOW_LONG = [
		'Sonntag',
		'Montag',
		'Dienstag',
		'Mittwoch',
		'Donnerstag',
		'Freitag',
		'Samstag'
	];

	let view = $state<'list' | 'month'>('list');
	let sheet = $state<{ event?: CalEvent; date?: string } | null>(null);
	let showPast = $state(false);

	const today = $derived(store.today);
	const events = $derived([...store.data.events].sort((a, b) => a.start.localeCompare(b.start)));
	const subjectOf = (id: string | null) => store.data.subjects.find((s) => s.id === id);
	const colorOf = (e: CalEvent) => subjectOf(e.subjectId)?.color ?? 'var(--faint)';
	const onDay = (d: string) =>
		events.filter((e) => e.start.slice(0, 10) <= d && (e.end ?? e.start.slice(0, 10)) >= d);
	const meta = (e: CalEvent) =>
		[
			EVENT_KINDS[e.kind],
			subjectOf(e.subjectId) && e.title !== subjectOf(e.subjectId)?.name
				? subjectOf(e.subjectId)!.name
				: null,
			timeOf(e.start),
			e.note || null
		]
			.filter(Boolean)
			.join(' · ');

	const addDays = (d: string, n: number) => {
		const x = parseLocal(d);
		x.setDate(x.getDate() + n);
		return toLocalDate(x);
	};
	const mondayOf = (d: string) => addDays(d, -((parseLocal(d).getDay() + 6) % 7));

	// ---- week strip (Mo–Fr) -----------------------------------------------------------
	let weekOffset = $state(0);
	const weekStart = $derived(addDays(mondayOf(today), weekOffset * 7));
	const week = $derived(Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)));

	// ---- upcoming groups ---------------------------------------------------------------
	const daysLeft = (d: string) =>
		Math.round((parseLocal(d).getTime() - parseLocal(today).getTime()) / 86_400_000);
	const groups = $derived.by(() => {
		const thisMon = mondayOf(today);
		const nextMon = addDays(thisMon, 7);
		const afterNext = addDays(thisMon, 14);
		const list = events.filter((e) => (showPast ? true : (e.end ?? e.start.slice(0, 10)) >= today));
		const out: { title: string; items: CalEvent[] }[] = [];
		for (const e of list) {
			const d = e.start.slice(0, 10);
			const title =
				d < today
					? 'Vergangen'
					: d < nextMon
						? 'Diese Woche'
						: d < afterNext
							? 'Nächste Woche'
							: `${MONTHS[parseLocal(d).getMonth()]}${parseLocal(d).getFullYear() !== parseLocal(today).getFullYear() ? ` ${parseLocal(d).getFullYear()}` : ''}`;
			const g = out.at(-1);
			if (g?.title === title) g.items.push(e);
			else out.push({ title, items: [e] });
		}
		return out;
	});
	const left = (d: string) => {
		const n = daysLeft(d);
		return n === 0 ? 'heute' : n === 1 ? 'morgen' : n > 1 ? `in ${n} T.` : '';
	};

	// ---- month grid --------------------------------------------------------------------
	let monthOffset = $state(0);
	let selected = $state<string | null>(null);
	const sel = $derived(selected ?? today);
	const monthFirst = $derived.by(() => {
		const t = parseLocal(today);
		return toLocalDate(new Date(t.getFullYear(), t.getMonth() + monthOffset, 1));
	});
	const monthLabel = $derived(
		`${MONTHS[parseLocal(monthFirst).getMonth()]} ${parseLocal(monthFirst).getFullYear()}`
	);
	const cells = $derived(Array.from({ length: 42 }, (_, i) => addDays(mondayOf(monthFirst), i)));
	const inMonth = (d: string) => d.slice(0, 7) === monthFirst.slice(0, 7);
	const selEvents = $derived(onDay(sel));
	const selTitle = $derived(
		`${DOW_LONG[parseLocal(sel).getDay()]}, ${parseLocal(sel).getDate()}. ${MONTHS[parseLocal(sel).getMonth()]}`
	);
</script>

{#snippet eventRow(e: CalEvent, withDate: boolean)}
	<button class="erow" type="button" onclick={() => (sheet = { event: e })}>
		{#if withDate}
			<span class="ed"
				><span class="tiny muted"
					>{['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][parseLocal(e.start).getDay()]}</span
				><strong>{parseLocal(e.start).getDate()}.</strong></span
			>
		{/if}
		<span class="eb" style:background={colorOf(e)}></span>
		<span class="et"
			><span class="ett">{e.title}</span><span class="tiny muted">{meta(e)}</span></span
		>
		{#if withDate}<span class="tiny muted">{left(e.start.slice(0, 10))}</span>{/if}
	</button>
{/snippet}

{#snippet monthGrid()}
	<div class="card month">
		<div class="mhead">
			<button
				class="btn ghost nav"
				type="button"
				aria-label="Vorheriger Monat"
				onclick={() => monthOffset--}><Icon name="back" /></button
			>
			<button
				class="mtitle"
				type="button"
				onclick={() => ((monthOffset = 0), (selected = null))}
				title="Zu heute">{monthLabel}</button
			>
			<button
				class="btn ghost nav"
				type="button"
				aria-label="Nächster Monat"
				onclick={() => monthOffset++}><Icon name="next" /></button
			>
		</div>
		<div class="mgrid dows">
			{#each DOW as d (d)}<span>{d}</span>{/each}
		</div>
		<div class="mgrid">
			{#each cells as d (d)}
				{@const evs = onDay(d)}
				<button
					class="day"
					class:out={!inMonth(d)}
					class:today={d === today}
					class:sel={d === sel}
					type="button"
					aria-pressed={d === sel}
					aria-label="{parseLocal(d).getDate()}. {MONTHS[parseLocal(d).getMonth()]}{evs.length
						? `, ${evs.length} Termin${evs.length > 1 ? 'e' : ''}`
						: ''}"
					onclick={() => (selected = d)}
					ondblclick={() => (sheet = { date: d })}
				>
					<span>{parseLocal(d).getDate()}</span>
					<span class="dots"
						>{#each evs.slice(0, 3) as e (e.id)}<span
								class="mdot"
								style:background={d === sel ? 'var(--on-strong)' : colorOf(e)}
							></span>{/each}</span
					>
				</button>
			{/each}
		</div>
	</div>
	<div class="dayhead">
		<h2 class="label">{selTitle}</h2>
		<button class="linkbtn small" type="button" onclick={() => (sheet = { date: sel })}
			>+ Termin an diesem Tag</button
		>
	</div>
	<div class="card list">
		{#each selEvents as e (e.id)}{@render eventRow(e, false)}{:else}<p class="none muted small">
				Nichts eingetragen.
			</p>{/each}
	</div>
{/snippet}

{#snippet listView()}
	<div class="week">
		<button
			class="btn ghost nav"
			type="button"
			aria-label="Vorherige Woche"
			onclick={() => weekOffset--}><Icon name="back" /></button
		>
		<div class="wdays">
			{#each week as d, i (d)}
				{@const evs = onDay(d)}
				<button
					class="wday"
					class:today={d === today}
					type="button"
					onclick={() => ((selected = d), (monthOffset = 0), (view = 'month'))}
					aria-label="{DOW[i]} {parseLocal(d).getDate()}."
				>
					<span class="tiny">{DOW[i]}</span>
					<strong>{parseLocal(d).getDate()}</strong>
					<span class="dots"
						>{#each evs.slice(0, 3) as e (e.id)}<span
								class="mdot"
								style:background={d === today ? 'var(--on-strong)' : colorOf(e)}
							></span>{/each}</span
					>
				</button>
			{/each}
		</div>
		<button
			class="btn ghost nav"
			type="button"
			aria-label="Nächste Woche"
			onclick={() => weekOffset++}><Icon name="next" /></button
		>
	</div>
	{#each groups as g (g.title)}
		<h2 class="gtitle label">{g.title}</h2>
		<div class="card list">
			{#each g.items as e (e.id)}{@render eventRow(e, true)}{/each}
		</div>
	{:else}
		<p class="muted empty">
			Keine anstehenden Termine. Trag deine Klausuren ein – dann siehst du sie auch bei den Fächern.
		</p>
	{/each}
	<button class="linkbtn small past" type="button" onclick={() => (showPast = !showPast)}
		>{showPast ? 'Vergangene ausblenden' : 'Vergangene anzeigen'}</button
	>
{/snippet}

<header class="head">
	<div>
		<div class="label">
			{MONTHS[parseLocal(today).getMonth()]}
			{parseLocal(today).getFullYear()}
		</div>
		<h1>Kalender</h1>
	</div>
	<button
		class="btn primary add"
		type="button"
		onclick={() => (sheet = {})}
		aria-label="Termin hinzufügen"
	>
		<Icon name="plus" size={18} stroke={2.4} />{#if ui.wide}Termin{/if}
	</button>
</header>

{#if ui.wide}
	<div class="cols">
		<div class="mcol">{@render monthGrid()}</div>
		<div class="lcol">{@render listView()}</div>
	</div>
{:else}
	<div class="seg full" role="tablist" aria-label="Ansicht">
		<button type="button" role="tab" aria-selected={view === 'list'} onclick={() => (view = 'list')}
			>Liste</button
		>
		<button
			type="button"
			role="tab"
			aria-selected={view === 'month'}
			onclick={() => (view = 'month')}>Monat</button
		>
	</div>
	{#if view === 'list'}{@render listView()}{:else}{@render monthGrid()}{/if}
{/if}

{#if sheet}<EventSheet
		onclose={() => (sheet = null)}
		event={sheet.event ?? null}
		date={sheet.date ?? null}
	/>{/if}

<style>
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 16px;
	}
	.head h1 {
		margin-top: 2px;
	}
	.add {
		min-height: 44px;
		min-width: 44px;
		padding: 0 12px;
		border-radius: 12px;
	}
	.cols {
		display: flex;
		flex-wrap: wrap;
		gap: 24px;
		align-items: flex-start;
	}
	.mcol {
		flex: 1 1 420px;
		max-width: 560px;
		min-width: 0;
	}
	.lcol {
		flex: 999 1 380px;
		min-width: 0;
	}
	.full {
		display: flex;
		margin-bottom: 14px;
	}
	.full button {
		flex: 1;
	}
	.week {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.nav {
		min-height: 40px;
		padding: 0 6px;
		color: var(--muted);
	}
	.wdays {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 4px;
	}
	.wday {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 8px 0;
		border: 0;
		border-radius: 12px;
		background: transparent;
		cursor: pointer;
	}
	.wday .tiny {
		color: var(--muted);
	}
	.wday strong {
		font-size: 17px;
		font-weight: 650;
	}
	.wday.today {
		background: var(--strong);
		color: var(--on-strong);
	}
	.wday.today .tiny {
		color: var(--on-strong);
		opacity: 0.75;
	}
	.dots {
		display: flex;
		gap: 3px;
		height: 6px;
		justify-content: center;
	}
	.mdot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
	}
	.gtitle {
		margin: 20px 4px 8px;
		font-weight: 600;
	}
	.list {
		overflow: hidden;
	}
	.erow {
		display: flex;
		gap: 12px;
		align-items: center;
		width: 100%;
		padding: 11px 14px;
		border: 0;
		border-top: 1px solid var(--line);
		background: transparent;
		text-align: left;
		cursor: pointer;
	}
	.erow:first-child {
		border-top: 0;
	}
	.erow:hover {
		background: var(--surface2);
	}
	.ed {
		width: 36px;
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.ed strong {
		font-size: 16px;
	}
	.eb {
		width: 3px;
		align-self: stretch;
		border-radius: 2px;
		flex: none;
	}
	.et {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.ett {
		font-size: 15px;
		font-weight: 550;
	}
	.none {
		margin: 0;
		padding: 14px;
	}
	.empty {
		margin: 20px 4px;
		line-height: 1.5;
	}
	.past {
		margin: 14px 4px;
	}
	.month {
		padding: 8px;
	}
	.mhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 4px 6px;
	}
	.mtitle {
		border: 0;
		background: none;
		font-size: 15px;
		font-weight: 650;
		cursor: pointer;
	}
	.mgrid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 2px;
	}
	.dows {
		text-align: center;
		font-size: 11px;
		font-weight: 600;
		color: var(--muted);
		padding-bottom: 4px;
	}
	.day {
		height: 48px;
		border: 0;
		border-radius: 12px;
		background: transparent;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		font-size: 15px;
		font-weight: 550;
		cursor: pointer;
	}
	.day:hover {
		background: var(--hover);
	}
	.day.out {
		color: var(--faint);
	}
	.day.today {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.day.sel {
		background: var(--strong);
		color: var(--on-strong);
	}
	.dayhead {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin: 18px 4px 8px;
	}
	.dayhead .label {
		font-weight: 600;
	}
</style>
