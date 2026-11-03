<script lang="ts">
	import { HALF_YEARS, type HalfYear } from '@oberstufen-planer/abi-engine-bw';
	import { HALF_YEAR_SHORT, OpError, targetFor, type Subject } from '@oberstufen-planer/app-core';
	import Icon from '../components/Icon.svelte';
	import Sheet from '../components/Sheet.svelte';
	import { fmt1 } from '../lib/format.ts';
	import { href } from '../lib/router.svelte.ts';
	import { store } from '../lib/store.svelte.ts';
	import { ui } from '../lib/ui.svelte.ts';

	const r = $derived(store.result);
	const data = $derived(store.data);
	const grade = $derived(r.grade ?? r.gradeIgnoringConditions);

	const counted = $derived(
		new Map(r.blockI.counted.map((c) => [`${c.subjectId}:${c.halfYear}`, c]))
	);
	const notCounted = $derived(
		new Map(r.blockI.notCounted.map((c) => [`${c.subjectId}:${c.halfYear}`, c]))
	);

	function cell(s: Subject, h: HalfYear) {
		const c = counted.get(`${s.id}:${h}`);
		const n = notCounted.get(`${s.id}:${h}`);
		const x = c ?? n;
		if (!x) return null;
		return { points: x.points, actual: x.actual, counted: !!c, doubled: !!c?.doubled };
	}

	// ---- exams -------------------------------------------------------------------------
	const examSubjects = $derived(store.views.map((v) => v.subject).filter((s) => s.exam));
	const examLine = (id: string) => r.blockII.exams.find((e) => e.subjectId === id);
	const examOf = (id: string) => data.exams.find((e) => e.subjectId === id);
	let examSheet = $state<Subject | null>(null);
	let written = $state('');
	let oral = $state('');
	let examError = $state('');
	function openExam(s: Subject) {
		const e = examOf(s.id);
		written = e?.written != null ? String(e.written) : '';
		oral = e?.oral != null ? String(e.oral) : '';
		examError = '';
		examSheet = s;
	}
	function saveExam(e: Event) {
		e.preventDefault();
		const s = examSheet!;
		const parse = (v: string) =>
			v.trim() === '' ? null : /^\d{1,2}$/.test(v.trim()) && Number(v) <= 15 ? Number(v) : NaN;
		const w = parse(written);
		const o = parse(oral);
		if (Number.isNaN(w) || Number.isNaN(o)) {
			examError = 'Punkte von 0 bis 15 – oder leer lassen.';
			return;
		}
		try {
			store.mutate({
				type: 'exam.set',
				subjectId: s.id,
				...(s.exam === 'written' ? { written: w, oral: o } : { oral: o })
			});
			examSheet = null;
		} catch (err) {
			examError = err instanceof OpError ? err.message : String(err);
		}
	}

	// ---- target ------------------------------------------------------------------------
	const goal = $derived(data.goal ?? 15);
	let goalText = $state('');
	$effect(() => {
		goalText = fmt1(goal / 10);
	});
	const target = $derived(targetFor(data, goal));
	function setGoal(tenths: number) {
		store.mutate({ type: 'goal.set', goal: Math.max(10, Math.min(40, tenths)) });
	}
	function typedGoal() {
		const n = Number(goalText.replace(',', '.'));
		if (Number.isFinite(n) && n >= 1 && n <= 4) setGoal(Math.round(n * 10));
		else goalText = fmt1(goal / 10);
	}

	// ---- admission ---------------------------------------------------------------------
	const has = (code: string) => r.issues.some((i) => i.code === code && i.severity === 'error');
	const rules = $derived([
		{ ok: !has('blockI-min'), t: 'Block I mindestens 200 Punkte', v: String(r.blockI.points) },
		{
			ok: !has('unterkurse'),
			t: 'Höchstens 8 Kurse unter 5 Punkten',
			v: String(r.blockI.unterkurse)
		},
		{
			ok: !has('unterkurse-lf'),
			t: 'Davon höchstens 3 im Leistungsfach',
			v: String(r.blockI.unterkurseLF)
		},
		{ ok: !has('zero-points'), t: 'Kein Pflichtkurs mit 0 Punkten', v: '' },
		{ ok: !has('blockII-min'), t: 'Block II mindestens 100 Punkte', v: `≈ ${r.blockII.points}` },
		{ ok: !has('blockII-20'), t: '3 Prüfungen mit mind. 5 Punkten, 2 davon Leistungsfach', v: '' },
		{ ok: !has('blockII-zero'), t: 'In jeder Prüfung mindestens 1 Punkt', v: '' }
	]);
	const RULE_CODES = [
		'blockI-min',
		'unterkurse',
		'unterkurse-lf',
		'zero-points',
		'blockII-min',
		'blockII-20',
		'blockII-zero'
	];
	const otherIssues = $derived(
		r.issues.filter((i) => i.severity !== 'info' && !RULE_CODES.includes(i.code))
	);
</script>

<header class="head">
	<div>
		<h1>Abitur</h1>
		<p class="muted small sub">
			Offene Halbjahre und Prüfungen sind geschätzt: so, als bleiben deine Noten, wie sie gerade
			sind.
		</p>
	</div>
	{#if store.platform.canPrint}<a class="btn" href={href({ name: 'summary' })}
			><Icon name="print" size={16} /> Als PDF</a
		>{/if}
</header>

<div class="cols">
	<div class="main-col">
		{#if !ui.wide}
			<section class="card pad sum">
				<div class="label">Abiturschnitt, Stand heute</div>
				<div class="line">
					<div class="big-number">{grade === null ? '–' : fmt1(grade)}</div>
					<div class="small muted">{r.total} von 900 Punkten</div>
				</div>
			</section>
		{/if}

		<section class="card" aria-labelledby="b1-h">
			<div class="ch">
				<h2 id="b1-h" class="card-title">
					Block I · Kurse <span class="muted w500">{r.blockI.points} / 600</span>
				</h2>
				<span class="legend tiny muted"
					><span class="lg"><span class="sw"></span>zählt</span><span>≈ geschätzt</span><span
						>LF zählen doppelt</span
					></span
				>
			</div>
			<div class="table-wrap">
				<table class="grid b1">
					<thead>
						<tr>
							<th scope="col" class="first">Fach</th>
							{#each HALF_YEARS as h (h)}<th scope="col" class="c">{HALF_YEAR_SHORT[h]}</th>{/each}
						</tr>
					</thead>
					<tbody>
						{#each store.views as v (v.subject.id)}
							<tr>
								<th scope="row" class="first">
									<a
										class="subj"
										href={href({ name: 'subject', id: v.subject.id, halfYear: null })}
									>
										<span class="dot" style:background={v.subject.color}></span>{v.subject.name}
										{#if v.subject.level === 'LF'}<span class="tiny muted">LF</span>{/if}
									</a>
								</th>
								{#each HALF_YEARS as h (h)}
									{@const c = cell(v.subject, h)}
									<td class="c">
										{#if c}
											<span
												class="pt"
												class:counted={c.counted}
												class:est={!c.actual}
												title={c.counted ? (c.doubled ? 'zählt doppelt' : 'zählt') : 'zählt nicht'}
											>
												{c.actual ? c.points : ui.wide ? `≈ ${c.points}` : `≈${c.points}`}
											</span>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="note small muted">
				Die App wählt automatisch die 40 Kurse, die dir am meisten bringen.
			</p>
		</section>

		<section class="card pad" aria-labelledby="b2-h">
			<h2 id="b2-h" class="card-title b2h">
				Block II · Prüfungen <span class="muted w500"
					>{r.projected ? '≈ ' : ''}{r.blockII.points} / 300</span
				>
			</h2>
			<div class="exams">
				{#each examSubjects as s (s.id)}
					{@const line = examLine(s.id)}
					{@const ex = examOf(s.id)}
					{@const done = s.exam === 'written' ? ex?.written != null : ex?.oral != null}
					<button class="exam" class:open={!done} type="button" onclick={() => openExam(s)}>
						<span class="en"><span class="dot sm" style:background={s.color}></span>{s.name}</span>
						<span class="tiny muted"
							>{s.exam === 'written' ? 'schriftlich' : 'mündlich'}{done
								? ''
								: ' · noch offen'}</span
						>
						{#if done}
							<span class="ev"
								>{s.exam === 'written'
									? ex?.written
									: ex?.oral}{#if s.exam === 'written' && ex?.oral != null}<span class="tiny muted">
										+ mdl. {ex.oral}</span
									>{/if}</span
							>
						{:else}
							<span class="ee">geschätzt ≈ {line ? Math.round(line.points / 4) : '–'}</span>
						{/if}
					</button>
				{:else}
					<p class="muted small">
						Noch keine Prüfungsfächer. <a href={href({ name: 'subjects' })}
							>In den Fächern festlegen</a
						>
					</p>
				{/each}
			</div>
		</section>
	</div>

	<aside class="side-col">
		{#if ui.wide}
			<section class="card pad">
				<h2 class="label">Abiturschnitt, Stand heute</h2>
				<div class="line">
					<div class="big-number">{grade === null ? '–' : fmt1(grade)}</div>
					<div class="small muted">{r.total} von 900 Punkten</div>
				</div>
			</section>
		{/if}

		<section class="card pad" aria-labelledby="goal-h">
			<h2 id="goal-h" class="card-title">Was brauche ich für …</h2>
			<div class="goal-row">
				<button
					class="step"
					type="button"
					aria-label="Zielnote 0,1 besser"
					onclick={() => setGoal(goal - 1)}>−</button
				>
				<label for="ziel" class="sr-only">Zielnote</label>
				<input
					id="ziel"
					class="input goal-in"
					inputmode="decimal"
					bind:value={goalText}
					onblur={typedGoal}
					onkeydown={(e) => e.key === 'Enter' && typedGoal()}
				/>
				<button
					class="step"
					type="button"
					aria-label="Zielnote 0,1 schlechter"
					onclick={() => setGoal(goal + 1)}>+</button
				>
			</div>
			{#if !target.reached && !target.impossible && (target.courses || target.exams)}
				<div class="need">
					{#if target.courses}
						<div class="nbox">
							<div class="tiny muted">Kurse ab jetzt</div>
							<div class="nv">Ø {fmt1(target.courses.needed)}</div>
							<div class="tiny muted">bisher Ø {fmt1(target.courses.current)}</div>
						</div>
					{/if}
					{#if target.exams}
						<div class="nbox">
							<div class="tiny muted">Prüfungen</div>
							<div class="nv">Ø {fmt1(target.exams.needed)}</div>
							<div class="tiny muted">geschätzt Ø {fmt1(target.exams.current)}</div>
						</div>
					{/if}
				</div>
			{/if}
			<p class="gt">
				{#if target.reached}
					Das hast du gerade schon – mit {r.total - (target.minTotal ?? 0)} Punkten Puffer.
				{:else if target.impossible}
					Rechnerisch nicht mehr erreichbar – dafür bräuchtest du in allem, was noch offen ist, mehr
					als 15 Punkte.
				{:else}
					Dir fehlen noch {target.missing} Punkte.
				{/if}
			</p>
			{#if target.incomplete}<p class="tiny muted">
					Deine Fächerwahl ist noch nicht vollständig – gerechnet wird ohne die
					Zulassungsbedingungen.
				</p>{/if}
		</section>

		<section class="card pad" aria-labelledby="zul-h">
			<h2 id="zul-h" class="card-title">Zulassung</h2>
			<ul class="rules">
				{#each rules as rule (rule.t)}
					<li class:bad={!rule.ok}>
						<span class="ri"
							><Icon name={rule.ok ? 'check' : 'alert'} size={16} stroke={2.4} /></span
						>
						<span
							>{rule.t}{#if rule.v}<span class="muted">&nbsp;· {rule.v}</span>{/if}</span
						>
					</li>
				{/each}
			</ul>
			{#if otherIssues.length}
				<div class="others">
					{#each otherIssues as i (i.code + i.message)}<p class="banner warn small">
							<Icon name="alert" size={16} />{i.message}
						</p>{/each}
				</div>
			{/if}
		</section>
	</aside>
</div>

{#if examSheet}
	<Sheet title="{examSheet.name} · Prüfung" onclose={() => (examSheet = null)} width={420}>
		<form class="ef" onsubmit={saveExam}>
			{#if examSheet.exam === 'written'}
				<label class="field"
					><span>Schriftliche Prüfung (Punkte)</span><input
						class="input"
						inputmode="numeric"
						bind:value={written}
						placeholder="noch offen"
					/></label
				>
				<label class="field"
					><span>Mündliche Zusatzprüfung (optional)</span><input
						class="input"
						inputmode="numeric"
						bind:value={oral}
						placeholder="keine"
					/></label
				>
			{:else}
				<label class="field"
					><span>Mündliche Prüfung (Punkte)</span><input
						class="input"
						inputmode="numeric"
						bind:value={oral}
						placeholder="noch offen"
					/></label
				>
			{/if}
			{#if examError}<p class="error-text">{examError}</p>{/if}
			<button class="btn accent big" type="submit">Speichern</button>
		</form>
	</Sheet>
{/if}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 24px;
	}
	.sub {
		margin: 6px 0 0;
	}
	.cols {
		display: flex;
		flex-wrap: wrap;
		gap: 24px;
		align-items: flex-start;
	}
	.main-col {
		flex: 999 1 560px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.side-col {
		flex: 1 1 320px;
		min-width: 0;
		max-width: 440px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.ch {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		padding: 16px 20px 8px;
	}
	.w500 {
		font-weight: 500;
	}
	.legend {
		display: flex;
		gap: 14px;
		align-items: center;
	}
	.lg {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.sw {
		width: 12px;
		height: 12px;
		border-radius: 3px;
		background: var(--tint);
		border: 1px solid var(--tint-bd);
	}
	.first {
		padding-left: 20px !important;
		text-align: left;
		font-weight: 500;
	}
	.b1 td,
	.b1 th {
		padding-top: 5px;
		padding-bottom: 5px;
	}
	.subj {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: var(--text);
		white-space: nowrap;
	}
	.c {
		text-align: center !important;
		width: 70px;
	}
	.pt {
		display: inline-block;
		min-width: 44px;
		padding: 4px 0;
		border-radius: 6px;
		color: var(--faint);
		font-weight: 600;
	}
	.pt.counted {
		background: var(--tint);
		color: var(--text);
	}
	.pt.est {
		font-weight: 400;
		color: var(--muted);
	}
	.pt.est:not(.counted) {
		color: var(--faint);
	}
	.note {
		margin: 0;
		padding: 10px 20px 16px;
	}
	.b2h {
		margin-bottom: 12px;
	}
	.exams {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 10px;
	}
	.exam {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: transparent;
		cursor: pointer;
		text-align: left;
	}
	.exam.open {
		border-style: dashed;
		border-color: var(--border2);
	}
	.exam:hover {
		border-color: var(--tint-bd);
	}
	.en {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
	}
	.sm {
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}
	.ev {
		margin-top: 8px;
		font-size: 24px;
		font-weight: 700;
	}
	@media (max-width: 600px) {
		.b1 .first {
			padding-left: 12px !important;
			max-width: 120px;
		}
		.b1 .subj {
			display: flex;
			gap: 6px;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			font-size: 13px;
		}
		.b1 .c {
			width: auto;
			padding-left: 2px !important;
			padding-right: 2px !important;
		}
		.pt {
			min-width: 0;
			width: 100%;
			font-size: 13px;
			padding: 4px 2px;
		}
		.ch {
			padding: 14px 12px 8px;
		}
		.note {
			padding: 10px 12px 14px;
		}
	}
	.ee {
		margin-top: 10px;
		font-size: 14px;
		color: var(--muted);
	}
	.line {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-top: 6px;
	}
	.goal-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
	}
	.step {
		width: 42px;
		height: 42px;
		border-radius: 10px;
		border: 1px solid var(--border2);
		background: var(--surface);
		font-size: 20px;
		cursor: pointer;
	}
	.goal-in {
		width: 96px;
		height: 48px;
		font-size: 24px;
		font-weight: 700;
		text-align: center;
	}
	.need {
		margin-top: 16px;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
	.nbox {
		background: var(--surface2);
		border-radius: 10px;
		padding: 12px;
	}
	.nv {
		font-size: 24px;
		font-weight: 700;
		margin: 2px 0;
	}
	.gt {
		margin: 14px 0 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--text2);
	}
	.rules {
		list-style: none;
		margin: 10px 0 0;
		padding: 0;
		display: grid;
		gap: 10px;
		font-size: 14px;
	}
	.rules li {
		display: flex;
		gap: 10px;
		align-items: flex-start;
	}
	.ri {
		color: var(--ok);
		margin-top: 1px;
	}
	.rules li.bad .ri {
		color: var(--warn-dot);
	}
	.others {
		display: grid;
		gap: 8px;
		margin-top: 14px;
	}
	.others p {
		margin: 0;
	}
	.ef {
		display: grid;
		gap: 14px;
	}
</style>
