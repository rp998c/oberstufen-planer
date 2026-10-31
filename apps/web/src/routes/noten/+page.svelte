<script lang="ts">
	import { HALF_YEARS } from '@oberstufen-planer/abi-engine-bw';
	import PointsCell from '$lib/components/PointsCell.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const avg = (values: (number | null | undefined)[]) => {
		const v = values.filter((x): x is number => typeof x === 'number');
		return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1).replace('.', ',') : '–';
	};
	const zeugnisAvg = $derived(
		avg(data.subjects.flatMap((s) => HALF_YEARS.map((h) => s.courses[h]?.points)))
	);
</script>

<svelte:head><title>Noten · Oberstufen-Planer</title></svelte:head>

<h1>Noten</h1>
<p class="muted">
	Tippe auf ein Halbjahr, um Noten einzutragen. Durchschnitt deiner Zeugnisnoten: <strong
		>{zeugnisAvg}</strong
	> Punkte.
</p>

<section class="card table-wrap">
	<table>
		<thead>
			<tr>
				<th>Fach</th>
				{#each HALF_YEARS as h (h)}<th class="c">{h}</th>{/each}
				<th class="c">Ø</th>
			</tr>
		</thead>
		<tbody>
			{#each data.subjects as s (s.id)}
				<tr>
					<th scope="row">
						<span class="dot" style:background={s.color}></span>
						{s.name}
						{#if s.level === 'LF'}<span class="lf">LF</span>{/if}
					</th>
					{#each HALF_YEARS as h (h)}
						<td class="c">
							{#if s.courses[h]}
								<a href="/noten/{s.id}/{h}" aria-label="{s.name}, Halbjahr {h}">
									<PointsCell course={s.courses[h]} />
								</a>
							{:else}
								<PointsCell course={undefined} />
							{/if}
						</td>
					{/each}
					<td class="c muted">{avg(HALF_YEARS.map((h) => s.courses[h]?.effective))}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<p class="legend muted">
	<PointsCell course={{ source: 'zeugnis', effective: 12 } as never} /> Zeugnis
	<PointsCell course={{ source: 'noten', effective: 11 } as never} /> aus Noten berechnet
	<PointsCell course={{ source: 'prognose', effective: 10 } as never} /> Prognose
</p>

<style>
	.c {
		text-align: center;
	}
	.table-wrap {
		padding: 0.5rem;
	}
	th,
	td {
		padding: 0.4rem 0.2rem;
	}
	th[scope='row'] {
		font-weight: 500;
		line-height: 1.25;
		hyphens: auto;
		overflow-wrap: break-word;
	}
	th[scope='row'] .dot {
		margin-right: 0.15rem;
	}
	.c :global(.pts) {
		min-width: 1.9rem;
	}
	td a {
		text-decoration: none;
		color: var(--text);
	}
	.lf {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--accent);
		vertical-align: super;
	}
	.legend {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		font-size: 0.9rem;
	}
</style>
