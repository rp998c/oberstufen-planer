<script lang="ts">
	import { HALF_YEARS } from '@oberstufen-planer/abi-engine-bw';
	import {
		EVENT_KINDS,
		HALF_YEAR_LONG,
		HALF_YEAR_SHORT,
		gradeText,
		targetFor
	} from '@oberstufen-planer/app-core';
	import Icon from '../components/Icon.svelte';
	import { dayMonth, fmt1, shortDate, weekday } from '../lib/format.ts';
	import { href } from '../lib/router.svelte.ts';
	import { store } from '../lib/store.svelte.ts';
	import { ui } from '../lib/ui.svelte.ts';

	let { onadd }: { onadd: () => void } = $props();

	const r = $derived(store.result);
	const data = $derived(store.data);
	const errors = $derived(r.issues.filter((i) => i.severity === 'error'));
	const grade = $derived(r.grade ?? r.gradeIgnoringConditions);
	const goal = $derived(data.goal);
	const target = $derived(goal ? targetFor(data, goal) : null);

	const upcoming = $derived(
		[...data.events]
			.filter((e) => e.start.slice(0, 10) >= store.today)
			.sort((a, b) => a.start.localeCompare(b.start))
	);
	const subjectOf = (id: string | null) => data.subjects.find((s) => s.id === id);
	const nextFor = (id: string) => upcoming.find((e) => e.subjectId === id);
	const kindLabel = (k: string) => EVENT_KINDS[k as keyof typeof EVENT_KINDS] ?? 'Termin';
	const h = $derived(store.currentHalfYear);
	const abiYear = $derived(data.profile.abiYear);
	const examLabel = { written: 'schriftl. Prüfung', oral: 'mündl. Prüfung' } as const;

	function eventTitle(e: (typeof upcoming)[number]) {
		const s = subjectOf(e.subjectId);
		return s ? `${s.name} · ${e.title === s.name ? kindLabel(e.kind) : e.title}` : e.title;
	}
</script>

{#snippet abiCard()}
	<section class="card pad" aria-labelledby="abi-h">
		<h2 id="abi-h" class="label">Abiturschnitt, Stand heute</h2>
		<div class="abi-line">
			<div class="big-number">{grade === null ? '–' : fmt1(grade)}</div>
			<div class="muted small">{r.total} von 900 Punkten{r.projected ? ' · geschätzt' : ''}</div>
		</div>
		<div class="bars small">
			<div>
				<div class="bar-label">
					<span>Block I · Kurse</span><span class="muted">{r.blockI.points} / 600</span>
				</div>
				<div class="bar">
					<div
						style:width="{(r.blockI.points / 600) * 100}%"
						style:background="var(--accent)"
					></div>
				</div>
			</div>
			<div>
				<div class="bar-label">
					<span>Block II · Prüfungen</span><span class="muted">≈ {r.blockII.points} / 300</span>
				</div>
				<div class="bar">
					<div
						style:width="{(r.blockII.points / 300) * 100}%"
						style:background="var(--accent2)"
					></div>
				</div>
			</div>
		</div>
		<a class="status small" class:bad={errors.length > 0} href={href({ name: 'abitur' })}>
			<Icon name={errors.length ? 'alert' : 'check'} size={16} stroke={2.4} />
			{errors.length
				? `${errors.length} ${errors.length === 1 ? 'Bedingung' : 'Bedingungen'} nicht erfüllt`
				: 'Alle Zulassungsbedingungen erfüllt'}
		</a>
	</section>
{/snippet}

{#snippet goalCard()}
	<section class="card pad" aria-labelledby="ziel-h">
		<div class="row-between">
			<h2 id="ziel-h" class="label">Dein Ziel</h2>
			<a class="small" href={href({ name: 'abitur' })}>{goal ? 'Ändern' : 'Festlegen'}</a>
		</div>
		{#if goal && target}
			<div class="goal">{fmt1(goal / 10)}</div>
			<p class="goal-text">
				{#if target.reached}
					Das hast du gerade schon – mit <strong
						>{store.result.total - (target.minTotal ?? 0)} Punkten</strong
					> Puffer.
				{:else if target.impossible}
					Rechnerisch nicht mehr erreichbar.
				{:else}
					Dir fehlen noch <strong>{target.missing} Punkte</strong>.{#if target.courses}
						Das schaffst du mit <strong>Ø {fmt1(target.courses.needed)} Punkten</strong> in den
						übrigen Kursen – bisher Ø {fmt1(target.courses.current)}.{/if}
				{/if}
			</p>
		{:else}
			<p class="goal-text muted">Leg eine Zielnote fest – dann siehst du, was du dafür brauchst.</p>
		{/if}
	</section>
{/snippet}

{#if ui.wide}
	<header class="head">
		<div>
			<div class="label">{HALF_YEAR_LONG[h]}{abiYear ? ` · Abitur ${abiYear}` : ''}</div>
			<h1>Übersicht</h1>
		</div>
		<button class="btn primary add" type="button" onclick={onadd}
			><Icon name="plus" size={16} stroke={2.4} /> Note eintragen</button
		>
	</header>

	<div class="cols">
		<section class="card table-card" aria-labelledby="kurse-h">
			<div class="row-between pad-x">
				<h2 id="kurse-h" class="card-title">Deine Kurse</h2>
				<div class="legend tiny muted">
					<span><strong class="z">12</strong> = Zeugnis</span><span>12 = vorläufig</span>
				</div>
			</div>
			<div class="table-wrap">
				<table class="grid">
					<thead>
						<tr>
							<th scope="col" class="first">Fach</th>
							{#each HALF_YEARS as x (x)}<th scope="col" class="c" class:now={x === h}
									>{HALF_YEAR_SHORT[x]}</th
								>{/each}
							<th scope="col" class="next">Als Nächstes</th>
						</tr>
					</thead>
					<tbody>
						{#each store.views as v (v.subject.id)}
							{@const n = nextFor(v.subject.id)}
							<tr>
								<th scope="row" class="first">
									<a
										class="subj"
										href={href({ name: 'subject', id: v.subject.id, halfYear: null })}
									>
										<span class="dot" style:background={v.subject.color}></span>
										<span class="name">{v.subject.name}</span>
										<span class="badge">{v.subject.level}</span>
										{#if v.subject.exam}<span class="tiny muted">{examLabel[v.subject.exam]}</span
											>{/if}
									</a>
								</th>
								{#each HALF_YEARS as x (x)}
									{@const c = v.halfYears[x]}
									<td class="c">
										{#if c}
											<a
												class="cell {c.source}"
												href={href({ name: 'subject', id: v.subject.id, halfYear: x })}
												aria-label="{v.subject.name}, {HALF_YEAR_SHORT[x]}">{c.effective ?? '–'}</a
											>
										{/if}
									</td>
								{/each}
								<td class="next small">
									{#if n}<span class="nd">{shortDate(n.start)}</span><span class="nw"
											>{n.title === v.subject.name ? kindLabel(n.kind) : n.title}</span
										>{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<div class="right">
			{@render abiCard()}
			{@render goalCard()}
			<section class="card pad" aria-labelledby="bald-h">
				<div class="row-between">
					<h2 id="bald-h" class="label">Demnächst</h2>
					<a class="small" href={href({ name: 'calendar' })}>Kalender</a>
				</div>
				{#each upcoming.slice(0, 5) as e (e.id)}
					<div class="ev">
						<div class="ev-date">
							<div class="tiny muted up">{weekday(e.start)}</div>
							<div class="ev-day">{dayMonth(e.start)}</div>
						</div>
						<span class="ev-bar" style:background={subjectOf(e.subjectId)?.color ?? 'var(--faint)'}
						></span>
						<div class="ev-title">{eventTitle(e)}</div>
					</div>
				{:else}
					<p class="muted small empty">
						Keine Termine. <a href={href({ name: 'calendar' })}>Termin eintragen</a>
					</p>
				{/each}
			</section>
		</div>
	</div>
{:else}
	<header class="mhead">
		<div>
			<div class="label">{HALF_YEAR_LONG[h]}</div>
			<h1>Übersicht</h1>
		</div>
		<a class="btn ghost gear" href={href({ name: 'settings' })} aria-label="Einstellungen"
			><Icon name="settings" size={22} /></a
		>
	</header>

	<a class="hero" href={href({ name: 'abitur' })}>
		<div class="label">Abiturschnitt, Stand heute</div>
		<div class="hero-line">
			<div class="hero-num">{grade === null ? '–' : fmt1(grade)}</div>
			{#if goal && target}
				<div class="hero-goal small muted">
					Ziel {fmt1(goal / 10)}<br /><strong
						>{target.reached
							? 'erreicht'
							: target.impossible
								? 'nicht erreichbar'
								: `noch ${target.missing} Punkte`}</strong
					>
				</div>
			{:else}
				<div class="hero-goal small muted">
					{r.total} Punkte{#if errors.length}<br /><strong class="warn"
							>{errors.length} Bedingung{errors.length === 1 ? '' : 'en'} offen</strong
						>{/if}
				</div>
			{/if}
		</div>
		<div class="bar">
			<div style:width="{(r.total / 900) * 100}%" style:background="var(--accent)"></div>
		</div>
	</a>

	{#if upcoming.length}
		<h2 class="section label">Demnächst</h2>
		<div class="soon">
			{#each upcoming.slice(0, 4) as e (e.id)}
				<a class="card soon-card" href={href({ name: 'calendar' })}>
					<div class="tiny muted">{shortDate(e.start)}</div>
					<div class="soon-title">
						<span
							class="dot small-dot"
							style:background={subjectOf(e.subjectId)?.color ?? 'var(--faint)'}
						></span>{eventTitle(e)}
					</div>
				</a>
			{/each}
		</div>
	{/if}

	<h2 class="section label">Kurse · dieses Halbjahr</h2>
	<div class="card list">
		{#each store.views as v (v.subject.id)}
			{@const c = v.halfYears[h]}
			<a class="list-row" href={href({ name: 'subject', id: v.subject.id, halfYear: null })}>
				<span class="dot" style:background={v.subject.color}></span>
				<span class="lname">{v.subject.name}</span>
				<span class="badge">{v.subject.level}</span>
				<span class="lval" class:z={c?.source === 'zeugnis'}>{c ? (c.effective ?? '–') : ''}</span>
				<span class="muted"><Icon name="next" size={16} /></span>
			</a>
		{/each}
	</div>

	<button class="fab" type="button" aria-label="Note eintragen" onclick={onadd}
		><Icon name="plus" size={24} stroke={2.6} /></button
	>
{/if}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 28px;
	}
	.head h1 {
		margin-top: 4px;
	}
	.add {
		min-height: 42px;
	}
	.cols {
		display: flex;
		flex-wrap: wrap;
		gap: 24px;
		align-items: flex-start;
	}
	.table-card {
		flex: 999 1 640px;
		min-width: 0;
		overflow: hidden;
	}
	.right {
		flex: 1 1 320px;
		min-width: 0;
		max-width: 440px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.row-between {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.pad-x {
		padding: 16px 20px 10px;
	}
	.legend {
		display: flex;
		gap: 14px;
	}
	.z {
		color: var(--text);
		font-weight: 700;
	}
	.first {
		padding-left: 20px !important;
		text-align: left;
		font-weight: 500;
	}
	.c {
		text-align: center;
		width: 64px;
	}
	th.now {
		color: var(--text);
	}
	.subj {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--text);
		white-space: nowrap;
	}
	.cell {
		display: inline-block;
		min-width: 36px;
		padding: 4px 0;
		border-radius: 7px;
		color: var(--muted);
		font-weight: 600;
	}
	.cell.noten {
		background: var(--tint);
		color: var(--text2);
	}
	.cell.zeugnis {
		color: var(--text);
		font-weight: 750;
	}
	.cell:hover {
		outline: 1px solid var(--tint-bd);
	}
	.next {
		padding-right: 20px !important;
		white-space: nowrap;
	}
	.nd {
		display: inline-block;
		width: 80px;
		color: var(--muted);
	}
	.nw {
		color: var(--text2);
	}
	.abi-line {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-top: 6px;
	}
	.bars {
		margin-top: 18px;
		display: grid;
		gap: 10px;
	}
	.bar-label {
		display: flex;
		justify-content: space-between;
	}
	.bar {
		height: 6px;
		background: var(--line);
		border-radius: 3px;
		margin-top: 5px;
		overflow: hidden;
	}
	.bar > div {
		height: 6px;
		border-radius: 3px;
	}
	.status {
		margin-top: 16px;
		padding-top: 14px;
		border-top: 1px solid var(--line);
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--ok);
	}
	.status.bad {
		color: var(--warn-text);
	}
	.goal {
		font-size: 22px;
		font-weight: 700;
		margin-top: 4px;
	}
	.goal-text {
		margin: 8px 0 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--text2);
	}
	.ev {
		display: flex;
		gap: 14px;
		align-items: center;
		padding: 9px 0;
		border-top: 1px solid var(--line);
	}
	.ev:first-of-type {
		margin-top: 10px;
	}
	.ev-date {
		width: 44px;
		text-align: center;
		flex: none;
	}
	.up {
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.ev-day {
		font-size: 16px;
		font-weight: 650;
	}
	.ev-bar {
		width: 3px;
		align-self: stretch;
		border-radius: 2px;
	}
	.ev-title {
		font-size: 14px;
		font-weight: 550;
		min-width: 0;
	}
	.empty {
		margin: 10px 0 0;
	}

	/* phone */
	.mhead {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		margin-bottom: 16px;
	}
	.mhead h1 {
		margin-top: 2px;
	}
	.gear {
		color: var(--muted);
		min-height: 44px;
		padding: 0 10px;
	}
	.hero {
		display: block;
		background: var(--tint);
		border: 1px solid var(--tint-bd);
		color: var(--text);
		border-radius: 18px;
		padding: 18px 18px 16px;
	}
	.hero-line {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-top: 4px;
	}
	.hero-num {
		font-size: 48px;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	.hero-goal {
		text-align: right;
	}
	.hero-goal strong {
		color: var(--text);
		font-weight: 600;
	}
	.hero-goal strong.warn {
		color: var(--warn-text);
	}
	.hero .bar {
		margin-top: 14px;
	}
	.section {
		margin: 22px 2px 8px;
		font-weight: 600;
	}
	.soon {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.soon-card {
		flex: 0 0 auto;
		min-width: 150px;
		padding: 12px;
		color: var(--text);
	}
	.soon-title {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 4px;
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
	}
	.small-dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}
	.list {
		overflow: hidden;
	}
	.lname {
		flex: 1;
		min-width: 0;
		font-size: 15px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.lval {
		width: 36px;
		text-align: right;
		font-size: 17px;
		font-weight: 600;
		color: var(--text2);
	}
	.lval.z {
		color: var(--text);
		font-weight: 750;
	}
	.fab {
		position: fixed;
		right: 16px;
		bottom: calc(84px + env(safe-area-inset-bottom));
		z-index: 25;
		width: 56px;
		height: 56px;
		border: 0;
		border-radius: 18px;
		background: var(--accent);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 8px 22px color-mix(in srgb, var(--accent) 40%, transparent);
		cursor: pointer;
	}
</style>
