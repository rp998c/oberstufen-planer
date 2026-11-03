<script lang="ts" module>
	import type { GradeKind, Subject } from '@oberstufen-planer/app-core';

	/** Grade kinds that make sense for a subject. */
	export function kindsFor(s: Subject): GradeKind[] {
		const out: GradeKind[] = [];
		if (s.weights.schriftlich > 0 || s.klausuren > 0) out.push('klausur');
		if (s.tests !== 'none') out.push('test');
		if (s.weights.schriftlich > 0) out.push('gfs');
		if (s.weights.muendlich > 0) out.push('muendlich');
		if (s.weights.praktisch > 0) out.push('praktisch');
		return out.length ? out : ['klausur'];
	}
</script>

<script lang="ts">
	import {
		GRADE_KIND_LABELS,
		HALF_YEAR_SHORT,
		OpError,
		sortedSubjects,
		todayLocal,
		type Grade
	} from '@oberstufen-planer/app-core';
	import type { HalfYear } from '@oberstufen-planer/abi-engine-bw';
	import { newId, store } from '../lib/store.svelte.ts';
	import Sheet from './Sheet.svelte';

	let {
		onclose,
		grade = null,
		subjectId = null,
		halfYear = null,
		kind = null,
		date = null,
		label = null
	}: {
		onclose: () => void;
		/** Edit an existing grade. */
		grade?: Grade | null;
		subjectId?: string | null;
		halfYear?: number | null;
		kind?: GradeKind | null;
		/** Preset date (e.g. from the calendar). */
		date?: string | null;
		/** Title, e.g. "Klausur 2". */
		label?: string | null;
	} = $props();

	const subjects = $derived(sortedSubjects(store.data.subjects));
	// svelte-ignore state_referenced_locally
	let sid = $state(grade?.subjectId ?? subjectId ?? subjects[0]?.id ?? '');
	const subject = $derived(subjects.find((s) => s.id === sid));
	// svelte-ignore state_referenced_locally
	let hj = $state<number>(grade?.halfYear ?? halfYear ?? store.currentHalfYear);
	// svelte-ignore state_referenced_locally
	let k = $state<GradeKind>(grade?.kind ?? kind ?? 'klausur');
	// svelte-ignore state_referenced_locally
	let points = $state(grade ? String(grade.points) : '');
	// svelte-ignore state_referenced_locally
	let day = $state(grade?.date ?? date ?? todayLocal());
	// svelte-ignore state_referenced_locally
	let note = $state(grade?.note ?? '');
	let error = $state('');
	// svelte-ignore state_referenced_locally
	let showMore = $state(!!grade?.note);

	// svelte-ignore state_referenced_locally
	const fixed = !!grade || !!subjectId;
	const kinds = $derived(subject ? kindsFor(subject) : []);
	const halfYears = $derived<HalfYear[]>(subject?.halfYears ?? [1, 2, 3, 4]);
	$effect(() => {
		if (subject && !kinds.includes(k)) k = kinds[0]!;
		if (subject && !halfYears.includes(hj as HalfYear))
			hj = halfYears.includes(store.currentHalfYear) ? store.currentHalfYear : halfYears[0]!;
	});
	const title = $derived(
		grade ? `${GRADE_KIND_LABELS[grade.kind]} bearbeiten` : (label ?? 'Note eintragen')
	);

	function save(e?: Event) {
		e?.preventDefault();
		error = '';
		const p = String(points ?? '').trim();
		if (!/^\d{1,2}$/.test(p) || Number(p) > 15) {
			error = 'Bitte Punkte von 0 bis 15 eingeben.';
			return;
		}
		if (!subject) {
			error = 'Bitte ein Fach wählen.';
			return;
		}
		try {
			store.mutate({
				type: 'grade.upsert',
				grade: {
					id: grade?.id ?? newId(),
					subjectId: sid,
					halfYear: hj as HalfYear,
					kind: k,
					points: Number(p),
					date: day || null,
					note: note.trim()
				}
			});
			onclose();
		} catch (err) {
			error = err instanceof OpError ? err.message : String(err);
		}
	}

	function remove() {
		if (!grade || !confirm('Diese Note löschen?')) return;
		store.mutate({ type: 'grade.delete', id: grade.id });
		onclose();
	}
</script>

<Sheet {title} {onclose} width={440}>
	<form class="form" onsubmit={save}>
		{#if !fixed}
			<label class="field">
				<span>Fach</span>
				<select class="input" bind:value={sid}>
					{#each subjects as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
				</select>
			</label>
		{/if}
		{#if !label || grade}
			<div class="row2">
				<label class="field">
					<span>Art</span>
					<select class="input" bind:value={k}>
						{#each kinds as x (x)}<option value={x}
								>{GRADE_KIND_LABELS[x]}{x === 'test' && subject?.tests === 'klausur'
									? ' (zählt mit wie 1 Klausur)'
									: x === 'gfs'
										? ' (zählt wie 1 Klausur)'
										: ''}</option
							>{/each}
					</select>
				</label>
				{#if !fixed || grade}
					<label class="field hj">
						<span>Halbjahr</span>
						<select class="input" bind:value={hj}>
							{#each halfYears as h (h)}<option value={h}>{HALF_YEAR_SHORT[h]}</option>{/each}
						</select>
					</label>
				{/if}
			</div>
		{/if}
		<div class="points">
			<label for="pts" class="sr-only">Punkte</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="pts"
				class="input pts"
				type="text"
				inputmode="numeric"
				pattern="[0-9]*"
				maxlength="2"
				placeholder="0–15"
				autocomplete="off"
				autofocus
				bind:value={points}
			/>
			<button class="btn accent big" type="submit">Speichern</button>
		</div>
		{#if error}<p class="error-text" role="alert">{error}</p>{/if}
		{#if showMore}
			<div class="row2">
				<label class="field"
					><span>Datum</span><input class="input" type="date" bind:value={day} /></label
				>
				<label class="field"
					><span>Notiz</span><input
						class="input"
						maxlength="200"
						bind:value={note}
						placeholder="optional"
					/></label
				>
			</div>
		{:else}
			<button type="button" class="linkbtn" onclick={() => (showMore = true)}>Datum & Notiz</button>
		{/if}
		{#if grade}
			<button type="button" class="btn danger" onclick={remove}>Note löschen</button>
		{/if}
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
	.row2 .field:only-child {
		grid-column: span 2;
	}
	.points {
		display: flex;
		gap: 10px;
	}
	.pts {
		flex: 1;
		height: 64px;
		font-size: 30px;
		font-weight: 700;
		text-align: center;
		border: 2px solid var(--accent);
		border-radius: 14px;
	}
	.points .btn {
		width: 130px;
		min-height: 64px;
		border-radius: 14px;
	}
	.linkbtn {
		justify-self: start;
	}
</style>
