<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		lead = '',
		children
	}: { title: string; lead?: string; children: Snippet } = $props();
</script>

<div class="op-root wrap">
	<main class="card box">
		<div class="logo" aria-hidden="true">
			<svg
				width="26"
				height="26"
				viewBox="0 0 24 24"
				fill="none"
				stroke="var(--text)"
				stroke-width="2.3"
				stroke-linecap="round"
			>
				<path d="M5 19V9" /><path d="M10 19V5" /><path d="M15 19v-7" /><path
					d="M20 19v-4"
					stroke="var(--accent)"
				/>
			</svg>
		</div>
		<h1>{title}</h1>
		{#if lead}<p class="lead">{lead}</p>{/if}
		<div class="content">{@render children()}</div>
	</main>
</div>

<style>
	.wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px 16px;
	}
	.box {
		width: 100%;
		max-width: 400px;
		padding: 28px 24px;
	}
	.logo {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: var(--surface2);
		border: 1px solid var(--border2);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 18px;
	}
	h1 {
		font-size: 24px;
	}
	.lead {
		margin: 8px 0 0;
		color: var(--muted);
		line-height: 1.5;
		font-size: 14px;
	}
	.content {
		margin-top: 22px;
	}
	.content :global(form) {
		display: grid;
		gap: 14px;
	}
</style>
