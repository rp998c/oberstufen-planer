<script lang="ts">
	/** App logo (variant A or C), drawn in the current theme colours. */
	let { size = 30, icon = 'A' }: { size?: number; icon?: 'A' | 'C' } = $props();
</script>

<span
	class="logo"
	style:width="{size}px"
	style:height="{size}px"
	style:border-radius="{Math.round(size * 0.27)}px"
>
	{#if icon === 'C'}
		<svg width={size * 0.66} height={size * 0.66} viewBox="0 0 48 48" aria-hidden="true">
			<path d="M4 18 24 9l20 9-20 9z" fill="var(--accent)" />
			<path d="M12 22v9c6 5 18 5 24 0v-9l-12 5.5z" fill="var(--accent)" opacity="0.55" />
			<path
				d="M18 34l4 4 9-9"
				fill="none"
				stroke="var(--text)"
				stroke-width="3.6"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	{:else}
		<svg
			width={size * 0.6}
			height={size * 0.6}
			viewBox="0 0 24 24"
			fill="none"
			stroke="var(--text)"
			stroke-width="2.3"
			stroke-linecap="round"
			aria-hidden="true"
		>
			<path d="M5 19V9" /><path d="M10 19V5" /><path d="M15 19v-7" /><path
				d="M20 19v-4"
				stroke="var(--accent)"
			/>
		</svg>
	{/if}
</span>

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		background: var(--surface2);
		border: 1px solid var(--border2);
	}
</style>
