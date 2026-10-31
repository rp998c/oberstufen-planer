<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		HALF_YEARS,
		examBlockIIPoints,
		formatGrade,
		minTotalForGrade,
		requiredExamPoints
	} from '@oberstufen-planer/abi-engine-bw';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const r = $derived(data.result);
	const name = (id: string) =>
		id === 'bll' ? 'Besondere Lernleistung' : (data.subjects.find((s) => s.id === id)?.name ?? id);
	const color = (id: string) => data.subjects.find((s) => s.id === id)?.color ?? 'var(--muted)';

	// --- target calculator (runs in the browser) -----------------------------------------
	const grades = Array.from({ length: 31 }, (_, i) => Math.round((1 + i / 10) * 10) / 10);
	let target = $state(2.0);
	const targetResult = $derived(requiredExamPoints(data.input, target));
	const minTotal = $derived(minTotalForGrade(target));

	// --- Block I --------------------------------------------------------------------------
	const counted = $derived(new Map(r.blockI.counted.map((c) => [c.key, c])));
	const notCounted = $derived(new Map(r.blockI.notCounted.map((c) => [c.key, c])));
	const include = $derived(new Set(data.overrides.include ?? []));
	const exclude = $derived(new Set(data.overrides.exclude ?? []));
	const stateOf = (key: string) =>
		include.has(key) ? 'include' : exclude.has(key) ? 'exclude' : 'auto';
	const nextState = (key: string) =>
		({ auto: 'include', include: 'exclude', exclude: 'auto' })[stateOf(key)];
	const lfs = $derived(data.subjects.filter((s) => s.level === 'LF'));
	const blockISubjects = $derived(
		data.subjects.filter((s) =>
			HALF_YEARS.some((h) => counted.has(`${s.id}:${h}`) || notCounted.has(`${s.id}:${h}`))
		)
	);

	const examLine = (id: string) => r.blockII.exams.find((e) => e.subjectId === id);
	const actualExamPoints = (e: PageData['exams'][number]) => {
		const w = e.result?.written ?? undefined;
		const o = e.result?.oral ?? undefined;
		if (w === undefined && o === undefined) return null;
		if (e.exam === 'written' && w === undefined) return null;
		return examBlockIIPoints({ written: w, oral: o });
	};
</script>

<svelte:head><title>Abitur · Oberstufen-Planer</title></svelte:head>

<h1>Abitur</h1>

{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

<section class="card totals">
	<div>
		<div class="muted">{r.projected ? 'Hochrechnung' : 'Ergebnis'}</div>
		<div class="big">
			{r.gradeIgnoringConditions !== null ? formatGrade(r.gradeIgnoringConditions) : '–'}
		</div>
		<div class={r.passed ? 'ok' : 'error'}>
			{r.passed ? 'Alle Bedingungen erfüllt' : 'Bedingungen nicht erfüllt'}
		</div>
	</div>
	<dl>
		<dt>Block I</dt>
		<dd>{r.blockI.points} / 600</dd>
		<dt>Block II</dt>
		<dd>{r.blockII.points} / 300</dd>
		<dt>Gesamt</dt>
		<dd><strong>{r.total} / 900</strong></dd>
	</dl>
</section>

{#if r.issues.length}
	<section class="card">
		<h2>Hinweise</h2>
		<ul class="issues">
			{#each r.issues as issue, i (i)}
				<li class={issue.severity}>{issue.message}</li>
			{/each}
		</ul>
	</section>
{/if}

<section class="card">
	<h2>Prüfungen (Block II)</h2>
	<p class="muted small">
		Leer gelassene Ergebnisse werden mit deiner Prognose bzw. deinem Kursschnitt hochgerechnet. Eine
		zusätzliche mündliche Prüfung im schriftlichen Fach zählt (2 × schriftlich + mündlich) / 3.
	</p>
	<div class="exams">
		{#each data.exams as e (e.id)}
			{@const line = examLine(e.id)}
			<form method="POST" action="?/exam" use:enhance class="exam">
				<input type="hidden" name="subjectId" value={e.id} />
				<div class="exam-head">
					<span class="dot" style:background={color(e.id)}></span>
					<strong>{name(e.id)}</strong>
					<span class="tag">{e.exam === 'written' ? 'schriftlich' : 'mündlich'}</span>
					<span class="pts" title="Punkte in vierfacher Wertung">
						{line?.points ?? '–'}
						{#if line && !line.actual}<small class="muted">(Prognose)</small>{/if}
						{#if actualExamPoints(e) !== null}<small class="muted">✓</small>{/if}
					</span>
				</div>
				<div class="exam-fields">
					{#if e.exam === 'written'}
						<label
							>Schriftlich <input
								name="written"
								type="number"
								min="0"
								max="15"
								value={e.result?.written ?? ''}
							/></label
						>
						<label
							>Prognose <input
								name="writtenForecast"
								type="number"
								min="0"
								max="15"
								value={e.result?.writtenForecast ?? ''}
							/></label
						>
						<label
							>Mündl. Zusatz <input
								name="oral"
								type="number"
								min="0"
								max="15"
								value={e.result?.oral ?? ''}
							/></label
						>
					{:else}
						<label
							>Mündlich <input
								name="oral"
								type="number"
								min="0"
								max="15"
								value={e.result?.oral ?? ''}
							/></label
						>
						<label
							>Prognose <input
								name="oralForecast"
								type="number"
								min="0"
								max="15"
								value={e.result?.oralForecast ?? ''}
							/></label
						>
					{/if}
					<button type="submit" class="secondary">Speichern</button>
				</div>
			</form>
		{/each}
	</div>
</section>

<section class="card">
	<h2>Zielrechner</h2>
	<div class="actions">
		<label for="target">Wunschnote</label>
		<select id="target" bind:value={target}>
			{#each grades as g (g)}<option value={g}>{formatGrade(g)}</option>{/each}
		</select>
	</div>
	<p aria-live="polite">
		{#if targetResult.openExams.length === 0}
			Alle Prüfungen sind eingetragen –
			{targetResult.examPoints !== null
				? 'das Ziel ist erreicht.'
				: 'das Ziel wird nicht erreicht.'}
		{:else if targetResult.examPoints === null}
			Mit deinen Kursnoten ist {formatGrade(target)} auch mit 15 Punkten in allen offenen Prüfungen nicht
			erreichbar.
		{:else}
			Du brauchst in {targetResult.openExams.length === 1
				? 'der offenen Prüfung'
				: `jeder der ${targetResult.openExams.length} offenen Prüfungen`}
			mindestens <strong>{targetResult.examPoints} Punkte</strong>.
		{/if}
		{#if minTotal !== null}
			<br /><span class="muted small"
				>Für {formatGrade(target)} sind mindestens {minTotal} Gesamtpunkte nötig, mit deinem Block I also
				{Math.max(0, minTotal - r.blockI.points)} Punkte in Block II.</span
			>
		{/if}
	</p>
</section>

<section class="card">
	<h2>Besondere Lernleistung</h2>
	<form method="POST" action="?/bll" use:enhance class="stack">
		<div class="grid2">
			<div class="field">
				<label for="bll-mode">Einbringen</label>
				<select id="bll-mode" name="mode" value={data.bll.mode}>
					<option value="none">nicht einbringen</option>
					<option value="blockI">in Block I (doppelt, statt 2 Kursen)</option>
					<option value="blockII">in Block II (statt einer mündlichen Prüfung)</option>
				</select>
			</div>
			<div class="field">
				<label for="bll-replaces">Ersetzt mündliche Prüfung in</label>
				<select id="bll-replaces" name="replacesSubjectId" value={data.bll.replacesSubjectId ?? ''}>
					<option value="">–</option>
					{#each data.subjects.filter((s) => s.exam === 'oral') as s (s.id)}
						<option value={s.id}>{s.name}</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="bll-points">Punkte</label>
				<input
					id="bll-points"
					name="points"
					type="number"
					min="0"
					max="15"
					value={data.bll.points ?? ''}
				/>
			</div>
			<div class="field">
				<label for="bll-forecast">Prognose</label>
				<input
					id="bll-forecast"
					name="forecast"
					type="number"
					min="0"
					max="15"
					value={data.bll.forecast ?? ''}
				/>
			</div>
		</div>
		<label class="inline"
			><input type="checkbox" name="fromSeminarkurs" checked={data.bll.fromSeminarkurs} /> Es ist der
			Seminarkurs (seine Kurse zählen dann nicht einzeln)</label
		>
		<div class="actions"><button type="submit">Speichern</button></div>
	</form>
</section>

<section class="card">
	<h2>Block I – angerechnete Kurse</h2>
	<p class="muted small">
		{r.blockI.counted.length} von 40 Kursen · {r.blockI.unterkurse} von max. 8 unterpunktet ({r
			.blockI.unterkurseLF}
		von max. 3 in Leistungsfächern) · Summe {r.blockI.rawSum} → {r.blockI.points} Punkte. Tippe auf einen
		Kurs, um ihn fest einzubringen (●) oder auszuschließen (✕). 🔒 = Pflichtkurs.
	</p>

	<form method="POST" action="?/doubled" use:enhance class="doubled">
		<span>Doppelt gewichtet:</span>
		{#each lfs as s (s.id)}
			<label class="inline"
				><input
					type="checkbox"
					name="doubled"
					value={s.id}
					checked={data.overrides.doubled?.includes(s.id)}
				/>
				{s.name}</label
			>
		{/each}
		<button type="submit" class="secondary">Übernehmen</button>
		<span class="muted small">
			{data.overrides.doubled
				? 'manuell'
				: `automatisch: ${r.blockI.doubled.map(name).join(' und ')}`}
		</span>
	</form>

	<div class="table-wrap">
		<table class="blocki">
			<thead>
				<tr
					><th>Fach</th>{#each HALF_YEARS as h (h)}<th class="c">{h}</th>{/each}</tr
				>
			</thead>
			<tbody>
				{#each blockISubjects as s (s.id)}
					<tr>
						<th scope="row"><span class="dot" style:background={s.color}></span> {s.name}</th>
						{#each HALF_YEARS as h (h)}
							{@const key = `${s.id}:${h}`}
							{@const c = counted.get(key) ?? notCounted.get(key)}
							<td class="c">
								{#if c}
									<form method="POST" action="?/course" use:enhance>
										<input type="hidden" name="key" value={key} />
										<input type="hidden" name="state" value={nextState(key)} />
										<button
											type="submit"
											class="course"
											class:in={counted.has(key)}
											class:under={c.points < 5}
											class:projected={!c.actual}
											disabled={c.mandatory && !include.has(key)}
											title={`${counted.has(key) ? 'angerechnet' : 'nicht angerechnet'}${c.doubled ? ', doppelt' : ''}${c.mandatory ? ', Pflicht' : ''}${!c.actual ? ', Prognose' : ''}`}
										>
											{c.points}{#if c.doubled}<sup>×2</sup>{/if}
											{#if c.mandatory && !include.has(key)}<span class="mark">🔒</span>
											{:else if stateOf(key) === 'include'}<span class="mark">●</span>
											{:else if stateOf(key) === 'exclude'}<span class="mark">✕</span>{/if}
										</button>
									</form>
								{:else}
									<span class="muted">·</span>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
				{#if r.blockI.counted.some((c) => c.subjectId === 'bll')}
					<tr>
						<th scope="row">Besondere Lernleistung</th>
						<td colspan="4">
							{r.blockI.counted.find((c) => c.subjectId === 'bll')?.points} Punkte, doppelt
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
	{#if (data.overrides.include?.length ?? 0) + (data.overrides.exclude?.length ?? 0) > 0 || data.overrides.doubled}
		<form method="POST" action="?/resetOverrides" use:enhance>
			<button type="submit" class="link">Alles wieder automatisch wählen</button>
		</form>
	{/if}
</section>

<style>
	h2 {
		font-size: 1.05rem;
		margin-top: 0;
	}
	section {
		margin-top: 1rem;
	}
	.small {
		font-size: 0.85rem;
	}
	.totals {
		display: flex;
		gap: 2rem;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
	}
	.big {
		font-size: 3rem;
		font-weight: 800;
		line-height: 1.1;
	}
	.ok {
		color: var(--accent);
	}
	dl {
		display: grid;
		grid-template-columns: auto auto;
		gap: 0.25rem 1rem;
		margin: 0;
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.exams {
		display: grid;
		gap: 0.75rem;
	}
	.exam {
		border-top: 1px solid var(--border);
		padding-top: 0.75rem;
	}
	.exam-head {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.exam-head .pts {
		margin-left: auto;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.exam-fields {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: flex-end;
		margin-top: 0.5rem;
	}
	.exam-fields label {
		display: grid;
		gap: 0.2rem;
		font-weight: 500;
		font-size: 0.85rem;
	}
	.exam-fields input {
		width: 5.5rem;
	}
	.inline {
		font-weight: 400;
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
	}
	.inline input {
		width: auto;
	}
	.doubled {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: center;
		margin-bottom: 0.75rem;
	}
	.blocki th,
	.blocki td {
		padding: 0.3rem 0.2rem;
	}
	.blocki th[scope='row'] {
		font-weight: 500;
		hyphens: auto;
	}
	.blocki form {
		margin: 0;
	}
	.c {
		text-align: center;
	}
	.course {
		min-width: 2.6rem;
		padding: 0.3rem 0.3rem;
		background: transparent;
		color: var(--muted);
		border: 1px dashed var(--border);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		position: relative;
	}
	.course.in {
		background: color-mix(in srgb, var(--accent) 15%, transparent);
		color: var(--text);
		border: 1px solid transparent;
		font-weight: 700;
	}
	.course.under {
		text-decoration: underline wavy var(--danger);
	}
	.course.projected {
		font-style: italic;
	}
	.course:disabled {
		opacity: 1;
		cursor: default;
	}
	.course sup {
		font-size: 0.6rem;
		margin-left: 1px;
	}
	.mark {
		font-size: 0.6rem;
		position: absolute;
		top: -0.35rem;
		right: -0.25rem;
		font-style: normal;
	}
</style>
