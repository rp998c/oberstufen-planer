<script lang="ts">
	import { HALF_YEARS, type HalfYear } from '@oberstufen-planer/abi-engine-bw';
	import { OpError, type GradeRow } from '@oberstufen-planer/app-core';
	import { app } from '../lib/app.svelte.ts';
	import { nav } from '../lib/nav.svelte.ts';

	let selected = $state<{ subjectId: string; halfYear: HalfYear } | null>(null);
	let error = $state('');

	// form state for a new grade
	let typeId = $state('');
	let points = $state<number | null>(null);
	let open = $state(false);
	let date = $state(new Date().toISOString().slice(0, 10));
	let weight = $state(1);
	let note = $state('');

	// half-year grade
	let zeugnis = $state<number | null>(null);
	let prognose = $state<number | null>(null);

	const entry = $derived(
		selected ? app.courses.find((c) => c.subject.id === selected!.subjectId) : undefined
	);
	const course = $derived(entry && selected ? entry.courses[selected.halfYear] : undefined);
	const grades = $derived(
		selected
			? app.snapshot.data.grades
					.filter((g) => g.subjectId === selected!.subjectId && g.halfYear === selected!.halfYear)
					.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
			: []
	);
	const types = $derived(
		[...app.snapshot.data.gradeTypes].sort((a, b) => a.sortOrder - b.sortOrder)
	);
	const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? '?';
	const fmt = (x: number) => x.toFixed(2).replace('.', ',');

	function openCourse(subjectId: string, halfYear: HalfYear) {
		selected = { subjectId, halfYear };
		error = '';
		const c = app.courses.find((x) => x.subject.id === subjectId)?.courses[halfYear];
		zeugnis = c?.points ?? null;
		prognose = c?.forecast ?? null;
		typeId = types[0]?.id ?? '';
		window.scrollTo(0, 0);
	}

	$effect(() => {
		if (!selected) return;
		return nav.onBack(() => (selected = null));
	});

	function run(fn: () => void) {
		error = '';
		try {
			fn();
			return true;
		} catch (e) {
			error = e instanceof OpError ? e.message : String(e);
			return false;
		}
	}

	function addGrade(e: SubmitEvent) {
		e.preventDefault();
		if (!selected) return;
		if (!open && (points === null || Number.isNaN(points))) {
			error = 'Bitte Punkte eingeben oder „noch offen“ wählen.';
			return;
		}
		const grade: GradeRow = {
			id: app.newId(),
			subjectId: selected.subjectId,
			halfYear: selected.halfYear,
			gradeTypeId: typeId,
			points: open ? null : points,
			forecast: open ? points : null,
			weight,
			date: date || null,
			note: note.trim()
		};
		if (run(() => app.mutate({ type: 'grade.upsert', grade }))) {
			points = null;
			note = '';
			open = false;
		}
	}

	function saveCourse(e: SubmitEvent) {
		e.preventDefault();
		if (!selected) return;
		const clean = (v: number | null) =>
			v === null || Number.isNaN(v) || (v as unknown) === '' ? null : v;
		run(() =>
			app.mutate({
				type: 'course.set',
				subjectId: selected!.subjectId,
				halfYear: selected!.halfYear,
				points: clean(zeugnis),
				forecast: clean(prognose)
			})
		);
	}

	const sourceText = {
		zeugnis: 'Zeugnisnote',
		prognose: 'deine Prognose',
		noten: 'aus deinen Noten',
		offen: 'noch offen'
	} as const;
</script>

{#if selected && entry && course}
	<p><button class="link" onclick={() => (selected = null)}>← Noten</button></p>
	<h1>
		<span class="dot" style:background={entry.subject.color}></span>
		{entry.subject.name} · {selected.halfYear}. HJ
	</h1>

	<section class="card summary">
		<div>
			<div class="big">{course.effective ?? '–'}</div>
			<div class="muted small">Punkte · {sourceText[course.source]}</div>
		</div>
		{#if course.fromGrades}<div>
				<div class="mid">{fmt(course.fromGrades.exact)}</div>
				<div class="muted small">Schnitt deiner Noten</div>
			</div>{/if}
	</section>

	{#if error}<p class="error" role="alert">{error}</p>{/if}

	<section class="card list-card">
		{#each grades as g (g.id)}
			<div class="row">
				<strong class="pts" class:open={g.points === null}
					>{g.points ?? (g.forecast !== null ? `≈${g.forecast}` : '?')}</strong
				>
				<span class="grow">
					{typeName(g.gradeTypeId)}{g.weight !== 1
						? ` ×${String(g.weight).replace('.', ',')}`
						: ''}{g.points === null ? ' · offen' : ''}<br />
					<small class="muted"
						>{g.date ? new Date(g.date + 'T00:00').toLocaleDateString('de-DE') : ''} {g.note}</small
					>
				</span>
				<button
					class="icon-btn"
					aria-label="Note löschen"
					onclick={() =>
						confirm('Note löschen?') && run(() => app.mutate({ type: 'grade.delete', id: g.id }))}
					>✕</button
				>
			</div>
		{:else}
			<p class="row muted">Noch keine Noten in diesem Halbjahr.</p>
		{/each}
	</section>

	<form class="card stack" onsubmit={addGrade}>
		<h2>Neue Note</h2>
		<div class="grid2">
			<div class="field">
				<label for="g-type">Art</label>
				<select id="g-type" bind:value={typeId}>
					{#each types as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="g-points">{open ? 'Erwartete Punkte (optional)' : 'Punkte'}</label>
				<input
					id="g-points"
					type="number"
					min="0"
					max="15"
					inputmode="numeric"
					bind:value={points}
				/>
			</div>
			<div class="field">
				<label for="g-date">Datum</label>
				<input id="g-date" type="date" bind:value={date} />
			</div>
			<div class="field">
				<label for="g-weight">Gewicht</label>
				<input id="g-weight" type="number" min="0.1" max="10" step="0.1" bind:value={weight} />
			</div>
		</div>
		<label class="inline"
			><input type="checkbox" bind:checked={open} /> Noch offen (angekündigt)</label
		>
		<div class="field">
			<label for="g-note">Notiz</label>
			<input id="g-note" bind:value={note} maxlength="200" />
		</div>
		<button type="submit">Hinzufügen</button>
	</form>

	<form class="card stack" onsubmit={saveCourse}>
		<h2>Halbjahresnote</h2>
		<div class="grid2">
			<div class="field">
				<label for="c-zeugnis">Zeugnisnote</label>
				<input
					id="c-zeugnis"
					type="number"
					min="0"
					max="15"
					inputmode="numeric"
					bind:value={zeugnis}
				/>
			</div>
			<div class="field">
				<label for="c-prognose">Eigene Prognose</label>
				<input
					id="c-prognose"
					type="number"
					min="0"
					max="15"
					inputmode="numeric"
					bind:value={prognose}
				/>
			</div>
		</div>
		<button type="submit" class="secondary">Speichern</button>
	</form>
{:else}
	<h1>Noten</h1>
	{#if app.courses.length === 0}
		<p class="card muted">Noch keine Fächer – bitte einmal im Browser einrichten.</p>
	{:else}
		<section class="card table">
			<table>
				<thead
					><tr
						><th>Fach</th>{#each HALF_YEARS as h (h)}<th class="c">{h}</th>{/each}</tr
					></thead
				>
				<tbody>
					{#each app.courses as { subject, courses } (subject.id)}
						<tr>
							<th scope="row"
								><span class="dot" style:background={subject.color}></span> {subject.name}</th
							>
							{#each HALF_YEARS as h (h)}
								{@const c = courses[h]}
								<td class="c">
									{#if c}
										<button
											class="cell {c.source}"
											onclick={() => openCourse(subject.id, h)}
											aria-label="{subject.name}, Halbjahr {h}"
										>
											{c.effective ?? '–'}
										</button>
									{:else}<span class="muted">·</span>{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
		<p class="muted small">Fett = Zeugnis · Rahmen = aus Noten · kursiv = Prognose</p>
	{/if}
{/if}

<style>
	h1 {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.table {
		padding: 0.4rem;
	}
	th,
	td {
		padding: 0.3rem 0.15rem;
	}
	th[scope='row'] {
		font-weight: 500;
		hyphens: auto;
		overflow-wrap: break-word;
	}
	.c {
		text-align: center;
	}
	.cell {
		min-width: 2.4rem;
		padding: 0.35rem 0.2rem;
		background: none;
		color: var(--muted);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}
	.cell.zeugnis {
		color: var(--text);
		font-weight: 700;
		background: color-mix(in srgb, var(--accent) 15%, transparent);
	}
	.cell.noten {
		color: var(--text);
		border: 1px solid var(--border);
	}
	.cell.prognose {
		color: var(--text);
		border: 1px dashed var(--muted);
		font-style: italic;
	}
	.summary {
		display: flex;
		gap: 2rem;
		align-items: flex-end;
	}
	.big {
		font-size: 2.5rem;
		font-weight: 800;
		line-height: 1;
	}
	.mid {
		font-size: 1.4rem;
		font-weight: 600;
	}
	.pts {
		font-size: 1.25rem;
		min-width: 2.4rem;
		text-align: center;
	}
	.pts.open {
		color: var(--muted);
		font-style: italic;
	}
	p.row {
		margin: 0;
	}
</style>
