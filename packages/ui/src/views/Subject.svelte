<script lang="ts">
	import {
		AREA_LABELS,
		type Area,
		type AreaWeights,
		type HalfYear
	} from '@oberstufen-planer/abi-engine-bw';
	import {
		GRADE_KIND_LABELS,
		HALF_YEAR_SHORT,
		OpError,
		halfYearOf,
		type Grade,
		type GradeKind
	} from '@oberstufen-planer/app-core';
	import GradeSheet from '../components/GradeSheet.svelte';
	import Icon from '../components/Icon.svelte';
	import { dayMonth, fmt1, fmt2, pct, shortDate, weightsLabel } from '../lib/format.ts';
	import { href, router } from '../lib/router.svelte.ts';
	import { store } from '../lib/store.svelte.ts';
	import { ui } from '../lib/ui.svelte.ts';

	let { id, halfYear }: { id: string; halfYear: number | null } = $props();

	const view = $derived(store.views.find((v) => v.subject.id === id));
	const subject = $derived(view?.subject);
	const taken = $derived(subject?.halfYears ?? []);
	const hj = $derived<HalfYear>(
		(halfYear && taken.includes(halfYear as HalfYear)
			? halfYear
			: taken.includes(store.currentHalfYear)
				? store.currentHalfYear
				: (taken[0] ?? 1)) as HalfYear
	);
	const hv = $derived(view?.halfYears[hj] ?? null);
	const grades = $derived(hv?.grades ?? []);
	const result = $derived(hv?.result ?? null);

	type SheetState = {
		grade?: Grade;
		kind?: GradeKind;
		date?: string | null;
		label?: string;
	} | null;
	let sheet = $state<SheetState>(null);
	let weightsOpen = $state(false);
	let zeugnis = $state('');
	let zError = $state('');
	$effect(() => {
		zeugnis = hv?.zeugnis != null ? String(hv.zeugnis) : '';
	});

	// "N" on this page: add a grade to this subject
	let seen = ui.quickAdd;
	$effect(() => {
		if (ui.quickAdd !== seen) {
			seen = ui.quickAdd;
			sheet = {};
		}
	});

	// open Klausur slots take their date from calendar entries of this subject
	const klausurEvents = $derived(
		store.data.events
			.filter(
				(e) =>
					e.subjectId === id &&
					e.kind === 'klausur' &&
					halfYearOf(e.start, store.data.profile.abiYear) === hj
			)
			.sort((a, b) => a.start.localeCompare(b.start))
	);
	const klausuren = $derived(grades.filter((g) => g.kind === 'klausur'));
	const slots = $derived(
		Array.from({ length: Math.max(subject?.klausuren ?? 0, klausuren.length) }, (_, i) => ({
			n: i + 1,
			grade: klausuren[i] ?? null,
			event: klausuren[i] ? null : (klausurEvents[i] ?? null)
		}))
	);
	const gfs = $derived(grades.filter((g) => g.kind === 'gfs'));
	const tests = $derived(grades.filter((g) => g.kind === 'test'));
	const testsOral = $derived(subject?.tests === 'muendlich');
	const testAvg = $derived(
		tests.length ? tests.reduce((a, g) => a + g.points, 0) / tests.length : null
	);
	const oral = $derived(
		grades.filter((g) => g.kind === 'muendlich' || (testsOral && g.kind === 'test'))
	);
	const practical = $derived(grades.filter((g) => g.kind === 'praktisch'));

	const total = $derived(
		subject
			? subject.weights.schriftlich + subject.weights.muendlich + subject.weights.praktisch || 1
			: 1
	);
	const share = (a: Area) => (subject ? pct(subject.weights[a] / total) : '');
	const areaResult = (a: Area) => result?.areas.find((x) => x.area === a);
	const showArea = (a: Area, list: Grade[]) => (subject?.weights[a] ?? 0) > 0 || list.length > 0;

	const PRESETS: { label: string; hint: string; w: AreaWeights }[] = [
		{
			label: '2/3 : 1/3',
			hint: 'schriftl. : mündl.',
			w: { schriftlich: 200 / 3, muendlich: 100 / 3, praktisch: 0 }
		},
		{
			label: '50 : 50',
			hint: 'schriftl. : mündl.',
			w: { schriftlich: 50, muendlich: 50, praktisch: 0 }
		},
		{
			label: '75 : 25',
			hint: 'schriftl. : mündl.',
			w: { schriftlich: 75, muendlich: 25, praktisch: 0 }
		},
		{
			label: '1/3 : 2/3',
			hint: 'schriftl. : mündl.',
			w: { schriftlich: 100 / 3, muendlich: 200 / 3, praktisch: 0 }
		},
		{
			label: '50 : 30 : 20',
			hint: '+ praktisch',
			w: { schriftlich: 50, muendlich: 30, praktisch: 20 }
		}
	];
	function setWeights(w: AreaWeights) {
		if (!subject) return;
		store.mutate({ type: 'subject.upsert', subject: { ...subject, weights: w } });
		weightsOpen = false;
	}

	function saveZeugnis() {
		zError = '';
		const v = zeugnis.trim();
		if (v === '' ? hv?.zeugnis == null : Number(v) === hv?.zeugnis) return;
		if (v !== '' && (!/^\d{1,2}$/.test(v) || Number(v) > 15)) {
			zError = 'Punkte von 0 bis 15.';
			return;
		}
		try {
			store.mutate({
				type: 'zeugnis.set',
				subjectId: id,
				halfYear: hj,
				points: v === '' ? null : Number(v)
			});
			ui.notify(v === '' ? 'Zeugnisnote entfernt' : 'Zeugnisnote gespeichert');
		} catch (e) {
			zError = e instanceof OpError ? e.message : String(e);
		}
	}

	function onKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		if (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || document.querySelector('[role=dialog]'))
			return;
		const n = Number(e.key);
		if (n >= 1 && n <= 4 && taken.includes(n as HalfYear))
			router.go({ name: 'subject', id, halfYear: n }, true);
	}

	const testInfo = $derived(
		subject?.tests === 'klausur'
			? 'Tests zählen zusammen wie 1 Klausur'
			: subject?.tests === 'muendlich'
				? 'Tests zählen als mündliche Noten'
				: null
	);
	const examText = { written: 'schriftliche Prüfung', oral: 'mündliche Prüfung' } as const;
</script>

<svelte:window onkeydown={onKey} />

{#snippet gradeCard(g: Grade, title: string)}
	<button
		class="gcard"
		type="button"
		onclick={() => (sheet = { grade: g })}
		aria-label="{title}: {g.points} Punkte, bearbeiten"
	>
		<span class="gt">{title}{g.date ? ` · ${dayMonth(g.date)}` : ''}</span>
		<span class="gp">{g.points}</span>
		{#if g.note}<span class="gn">{g.note}</span>{/if}
	</button>
{/snippet}

{#snippet emptyCard(title: string, sub: string, open: () => void)}
	<button class="gcard empty" type="button" onclick={open}>
		<span class="gt">{title}</span>
		<span class="ge">{sub}</span>
	</button>
{/snippet}

{#snippet areaHead(a: Area, idText: string)}
	{@const ar = areaResult(a)}
	<div class="ahead">
		<h2 id={idText} class="card-title">
			{AREA_LABELS[a]} <span class="muted w500">· {share(a)}</span>
		</h2>
		{#if ar}<span class="small muted" class:struck={ar.ignored}>Ø {fmt2(ar.average)}</span>{/if}
	</div>
{/snippet}

{#if !subject}
	<p class="muted">
		Dieses Fach gibt es nicht (mehr). <a href={href({ name: 'overview' })}>Zur Übersicht</a>
	</p>
{:else}
	{#if ui.wide}
		<div class="crumb small">
			<a href={href({ name: 'overview' })}>Übersicht</a> / {subject.name}
		</div>
	{:else}
		<a class="back" href={href({ name: 'overview' })} aria-label="Zurück"
			><Icon name="back" size={22} stroke={2.2} /></a
		>
	{/if}
	<header class="head">
		<span class="sq" style:background={subject.color}></span>
		<h1>{subject.name}</h1>
		<span class="badge lvl">{subject.level === 'LF' ? 'Leistungsfach' : 'Basisfach'}</span>
		{#if subject.exam && ui.wide}<span class="small muted">{examText[subject.exam]}</span>{/if}
	</header>

	{#if taken.length > 1}
		<div class="seg tabs" role="tablist" aria-label="Halbjahr">
			{#each taken as x (x)}
				<button
					type="button"
					role="tab"
					aria-selected={x === hj}
					onclick={() => router.go({ name: 'subject', id, halfYear: x }, true)}
					>{HALF_YEAR_SHORT[x]}</button
				>
			{/each}
		</div>
	{/if}

	<div class="cols">
		<div class="main-col">
			<div class="wbar">
				<span class="small muted">Gewichtung</span>
				<div class="pop-anchor">
					<button
						class="chip"
						type="button"
						aria-expanded={weightsOpen}
						onclick={() => (weightsOpen = !weightsOpen)}
					>
						{weightsLabel(subject.weights)}
						<Icon name="chevron" size={14} />
					</button>
					{#if weightsOpen}
						<div class="pop card" role="menu">
							{#each PRESETS as p (p.label)}
								<button
									type="button"
									role="menuitem"
									class="pop-item"
									class:on={weightsLabel(p.w) === weightsLabel(subject.weights)}
									onclick={() => setWeights(p.w)}
								>
									<strong>{p.label}</strong><span class="tiny muted">{p.hint}</span>
								</button>
							{/each}
							<a class="pop-foot tiny" href={href({ name: 'subjects' })}
								>Eigene Werte, z. B. 1/3 oder 45 % – in der Fächer-Tabelle</a
							>
						</div>
					{/if}
				</div>
				<span class="small muted info">
					{subject.klausuren}
					{subject.klausuren === 1 ? 'Klausur' : 'Klausuren'} pro Halbjahr{testInfo
						? ` · ${testInfo}`
						: ''}
				</span>
			</div>

			{#if showArea('schriftlich', [...klausuren, ...gfs, ...(testsOral ? [] : tests)])}
				<section class="card pad" aria-labelledby="a-s">
					{@render areaHead('schriftlich', 'a-s')}
					<div class="ggrid">
						{#each slots as s (s.n)}
							{#if s.grade}
								{@render gradeCard(s.grade, `Klausur ${s.n}`)}
							{:else}
								{@render emptyCard(
									`Klausur ${s.n}${s.event ? ` · ${shortDate(s.event.start)}` : ''}`,
									'Punkte eintragen',
									() =>
										(sheet = {
											kind: 'klausur',
											date: s.event?.start.slice(0, 10) ?? null,
											label: `Klausur ${s.n}`
										})
								)}
							{/if}
						{/each}
						{#each gfs as g (g.id)}{@render gradeCard(g, 'GFS')}{/each}
						{#if !testsOral && tests.length}
							<div class="gcard tests">
								<span class="gt"
									>Tests{subject.tests === 'klausur' ? ' · zählen wie 1 Klausur' : ''}</span
								>
								<span class="gp">{testAvg === null ? '–' : fmt1(testAvg)}</span>
								<span class="tlist">
									{#each tests as t (t.id)}<button
											type="button"
											class="tp"
											onclick={() => (sheet = { grade: t })}
											aria-label="Test {t.points} Punkte bearbeiten">{t.points}</button
										>{/each}
								</span>
							</div>
						{/if}
					</div>
					<div class="chips">
						{#if slots.every((s) => s.grade)}<button
								class="chip"
								type="button"
								onclick={() => (sheet = { kind: 'klausur' })}>+ Klausur</button
							>{/if}
						{#if subject.tests === 'klausur'}<button
								class="chip"
								type="button"
								onclick={() => (sheet = { kind: 'test', label: 'Test' })}>+ Test</button
							>{/if}
						<button
							class="chip"
							type="button"
							onclick={() => (sheet = { kind: 'gfs', label: 'GFS' })}
							>+ GFS <span class="muted">(zählt wie 1 Klausur)</span></button
						>
					</div>
				</section>
			{/if}

			{#if showArea('muendlich', oral)}
				<section class="card pad" aria-labelledby="a-m">
					{@render areaHead('muendlich', 'a-m')}
					<div class="ggrid">
						{#each oral as g (g.id)}{@render gradeCard(
								g,
								g.kind === 'test' ? 'Test' : 'Mündlich'
							)}{/each}
						{@render emptyCard(
							'Mündlich',
							'+ Note',
							() => (sheet = { kind: 'muendlich', label: 'Mündliche Note' })
						)}
					</div>
					{#if testsOral}<div class="chips">
							<button
								class="chip"
								type="button"
								onclick={() => (sheet = { kind: 'test', label: 'Test' })}>+ Test</button
							>
						</div>{/if}
				</section>
			{/if}

			{#if showArea('praktisch', practical)}
				<section class="card pad" aria-labelledby="a-p">
					{@render areaHead('praktisch', 'a-p')}
					<div class="ggrid">
						{#each practical as g (g.id)}{@render gradeCard(g, 'Praktisch')}{/each}
						{@render emptyCard(
							'Praktisch',
							'+ Note',
							() => (sheet = { kind: 'praktisch', label: 'Praktische Note' })
						)}
					</div>
				</section>
			{/if}
		</div>

		<aside class="side-col">
			<section class="card pad" aria-labelledby="res-h">
				<h2 id="res-h" class="label">
					Halbjahresnote{hv?.source === 'zeugnis' ? ' laut Zeugnis' : ', vorläufig'}
				</h2>
				<div class="res">
					<div class="big-number">{hv?.effective ?? '–'}</div>
					<div class="small muted">
						{#if hv?.source === 'zeugnis'}Punkte{#if result}
								· aus Noten {fmt2(result.exact)}{/if}{:else if result}Punkte · genau {fmt2(
								result.exact
							)}{:else}noch keine Noten{/if}
					</div>
				</div>
				{#if result}
					<div class="breakdown small">
						{#each result.areas as a (a.area)}
							<div class:struck={a.ignored}>
								<span>{AREA_LABELS[a.area]} Ø {fmt2(a.average)}</span><span
									>× {a.ignored ? '0 %' : pct(a.share)}</span
								>
							</div>
						{/each}
					</div>
				{/if}
				<form class="z" onsubmit={(e) => (e.preventDefault(), saveZeugnis())}>
					<label for="zeugnis" class="small w500">Zeugnisnote</label>
					<input
						id="zeugnis"
						class="input"
						inputmode="numeric"
						placeholder="noch nicht da"
						bind:value={zeugnis}
						onblur={saveZeugnis}
					/>
					{#if zError}<p class="error-text">{zError}</p>{/if}
					<p class="tiny muted">Sobald eingetragen, zählt nur noch sie.</p>
				</form>
			</section>
		</aside>
	</div>

	{#if !ui.wide}
		<button class="fab" type="button" aria-label="Note eintragen" onclick={() => (sheet = {})}
			><Icon name="plus" size={24} stroke={2.6} /></button
		>
	{/if}

	{#if sheet}
		<GradeSheet
			onclose={() => (sheet = null)}
			grade={sheet.grade ?? null}
			subjectId={id}
			halfYear={hj}
			kind={sheet.kind ?? null}
			date={sheet.date ?? null}
			label={sheet.label ? `${sheet.label} · ${subject.name}` : null}
		/>
	{/if}
{/if}

<style>
	.crumb {
		color: var(--muted);
	}
	.crumb a {
		color: var(--muted);
	}
	.back {
		display: inline-flex;
		width: 44px;
		height: 44px;
		margin: -8px 0 0 -10px;
		align-items: center;
		justify-content: center;
		color: var(--text);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin: 8px 0 16px;
	}
	.sq {
		width: 14px;
		height: 14px;
		border-radius: 4px;
	}
	.lvl {
		font-size: 12px;
		padding: 3px 8px;
	}
	.tabs {
		margin-bottom: 20px;
	}
	.cols {
		display: flex;
		flex-wrap: wrap;
		gap: 24px;
		align-items: flex-start;
	}
	.main-col {
		flex: 999 1 540px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.side-col {
		flex: 1 1 300px;
		min-width: 0;
		max-width: 400px;
	}
	.wbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	.pop-anchor {
		position: relative;
	}
	.pop {
		position: absolute;
		top: 42px;
		left: 0;
		z-index: 30;
		width: 270px;
		padding: 6px;
		box-shadow: 0 12px 32px var(--shadow);
	}
	.pop-item {
		display: flex;
		width: 100%;
		justify-content: space-between;
		align-items: center;
		border: 0;
		background: transparent;
		border-radius: 8px;
		padding: 10px 12px;
		cursor: pointer;
		font-size: 14px;
	}
	.pop-item:hover,
	.pop-item.on {
		background: var(--tint);
	}
	.pop-foot {
		display: block;
		border-top: 1px solid var(--line);
		margin-top: 6px;
		padding: 8px 12px 4px;
		color: var(--muted);
	}
	.ahead {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 12px;
	}
	.w500 {
		font-weight: 500;
	}
	.ggrid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 10px;
	}
	.gcard {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		min-height: 76px;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: transparent;
		text-align: left;
		cursor: pointer;
	}
	.gcard:hover {
		border-color: var(--tint-bd);
	}
	.gcard.empty {
		border-style: dashed;
		border-color: var(--border2);
	}
	.gcard.tests {
		cursor: default;
	}
	.gt {
		font-size: 12px;
		color: var(--muted);
	}
	.gp {
		font-size: 26px;
		font-weight: 700;
	}
	.gn {
		font-size: 12px;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}
	.ge {
		margin-top: 8px;
		font-size: 15px;
		color: var(--text2);
	}
	.gcard.empty:hover .ge {
		color: var(--link);
	}
	.tlist {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 2px;
	}
	.tp {
		border: 1px solid var(--border2);
		background: var(--surface2);
		border-radius: 6px;
		padding: 1px 7px;
		font-size: 12px;
		cursor: pointer;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
	}
	.res {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-top: 6px;
	}
	.breakdown {
		margin-top: 14px;
		display: grid;
		gap: 6px;
		color: var(--text2);
	}
	.breakdown div {
		display: flex;
		justify-content: space-between;
	}
	.struck {
		text-decoration: line-through;
		color: var(--faint) !important;
	}
	.z {
		margin-top: 16px;
		padding-top: 14px;
		border-top: 1px solid var(--line);
		display: grid;
		gap: 6px;
	}
	.z p {
		margin: 0;
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
	@media (max-width: 899px) {
		.ggrid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.side-col {
			max-width: none;
			order: -1;
		}
	}
</style>
