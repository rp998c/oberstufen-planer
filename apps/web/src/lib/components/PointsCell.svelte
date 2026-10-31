<script lang="ts">
	import type { CourseView } from '$lib/server/data.ts';

	let { course }: { course: CourseView | undefined } = $props();

	const titles = {
		zeugnis: 'Zeugnisnote',
		noten: 'aus deinen Noten berechnet',
		prognose: 'deine Prognose',
		offen: 'noch keine Noten'
	} as const;
</script>

{#if !course}
	<span class="none" title="nicht belegt">·</span>
{:else}
	<span class="pts {course.source}" title={titles[course.source]}>
		{course.effective ?? '–'}
	</span>
{/if}

<style>
	.pts {
		display: inline-block;
		min-width: 2.2rem;
		text-align: center;
		padding: 0.15rem 0.35rem;
		border-radius: 6px;
		font-variant-numeric: tabular-nums;
	}
	.zeugnis {
		font-weight: 700;
		background: color-mix(in srgb, var(--accent) 15%, transparent);
	}
	.noten {
		border: 1px solid var(--border);
	}
	.prognose {
		border: 1px dashed var(--muted);
		font-style: italic;
	}
	.offen {
		color: var(--muted);
	}
	.none {
		color: var(--border);
	}
</style>
