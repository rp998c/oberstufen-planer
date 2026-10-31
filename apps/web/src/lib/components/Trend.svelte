<script lang="ts">
	/**
	 * Single-series trend of one subject over the four half-years (0–15 points).
	 * Solid markers = report-card grades, hollow = forecasts. Dashed line at 5 points
	 * marks the Unterkurs threshold. Each point has a hover/tap tooltip.
	 */
	interface Point {
		halfYear: number;
		points: number;
		actual: boolean;
	}
	let { points, color, label }: { points: Point[]; color: string; label: string } = $props();

	const W = 160;
	const H = 56;
	const PAD_X = 10;
	const PAD_Y = 6;
	const x = (h: number) => PAD_X + ((h - 1) / 3) * (W - 2 * PAD_X);
	const y = (p: number) => PAD_Y + (1 - p / 15) * (H - 2 * PAD_Y);
	const path = $derived(
		points
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.halfYear).toFixed(1)},${y(p.points).toFixed(1)}`)
			.join(' ')
	);
</script>

<svg
	viewBox="0 0 {W} {H}"
	role="img"
	aria-label="{label}: {points
		.map((p) => `Halbjahr ${p.halfYear} ${p.points} Punkte${p.actual ? '' : ' (Prognose)'}`)
		.join(', ')}"
>
	<line class="threshold" x1={PAD_X} x2={W - PAD_X} y1={y(5)} y2={y(5)} />
	{#if points.length > 1}
		<path
			d={path}
			fill="none"
			stroke={color}
			stroke-width="2"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
	{/if}
	{#each points as p (p.halfYear)}
		<g class="pt">
			<circle class="hit" cx={x(p.halfYear)} cy={y(p.points)} r="10" />
			<circle
				cx={x(p.halfYear)}
				cy={y(p.points)}
				r="4"
				fill={p.actual ? color : 'var(--surface)'}
				stroke={color}
				stroke-width="2"
			/>
			<title>Halbjahr {p.halfYear}: {p.points} Punkte{p.actual ? '' : ' (Prognose)'}</title>
		</g>
	{/each}
</svg>

<style>
	svg {
		width: 100%;
		height: auto;
		display: block;
		overflow: visible;
	}
	.threshold {
		stroke: var(--border);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.hit {
		fill: transparent;
	}
	.pt:hover circle:not(.hit) {
		stroke-width: 3;
	}
</style>
