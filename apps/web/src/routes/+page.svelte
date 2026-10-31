<script lang="ts">
	import {
		formatGrade,
		gradeFromTotalPoints,
		MAX_TOTAL_POINTS
	} from '@oberstufen-planer/abi-engine-bw';

	let total = $state(650);

	const result = $derived.by(() => {
		if (!Number.isInteger(total) || total < 0 || total > MAX_TOTAL_POINTS)
			return 'Ungültige Eingabe';
		const grade = gradeFromTotalPoints(total);
		return grade === null ? 'nicht bestanden (unter 300 Punkte)' : formatGrade(grade);
	});
</script>

<svelte:head><title>Übersicht · Oberstufen-Planer</title></svelte:head>

<h1>Übersicht</h1>

<section class="card">
	<h2>Gesamtpunktzahl → Abiturnote</h2>
	<label for="total">Gesamtpunktzahl (Block I + Block II, max. 900)</label>
	<input id="total" type="number" min="0" max="900" step="1" bind:value={total} />
	<p class="result">Durchschnittsnote: <strong>{result}</strong></p>
</section>

<p class="hint">
	Notenerfassung, Hochrechnung und Kalender folgen in den nächsten Meilensteinen (siehe
	docs/PLAN.md).
</p>

<style>
	h2 {
		font-size: 1.1rem;
		margin-top: 0;
	}
	.result {
		font-size: 1.15rem;
		margin-bottom: 0;
	}
	.hint {
		color: var(--muted);
	}
</style>
