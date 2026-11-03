<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onBack, ui } from '../lib/ui.svelte.ts';
	import Icon from './Icon.svelte';

	let {
		title,
		onclose,
		children,
		footer,
		width = 480
	}: {
		title: string;
		onclose: () => void;
		children: Snippet;
		footer?: Snippet;
		width?: number;
	} = $props();

	let box = $state<HTMLDivElement>();
	$effect(() => onBack(onclose));
	$effect(() => {
		const prev = document.activeElement as HTMLElement | null;
		const first = box?.querySelector<HTMLElement>(
			'[autofocus], input, select, textarea, button:not(.x)'
		);
		first?.focus();
		return () => prev?.focus?.();
	});
	function key(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			onclose();
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="scrim" class:wide={ui.wide} onkeydown={key}>
	<button class="backdrop" type="button" aria-label="Schließen" tabindex="-1" onclick={onclose}
	></button>
	<div
		class="sheet card"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		bind:this={box}
		style:--w="{width}px"
	>
		{#if !ui.wide}<div class="grip" aria-hidden="true"></div>{/if}
		<div class="head">
			<h2>{title}</h2>
			<button class="x btn ghost" type="button" aria-label="Schließen" onclick={onclose}
				><Icon name="close" /></button
			>
		</div>
		<div class="body">{@render children()}</div>
		{#if footer}<div class="foot">{@render footer()}</div>{/if}
	</div>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	.scrim.wide {
		align-items: center;
		padding: 24px;
	}
	.backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		background: var(--scrim);
	}
	.sheet {
		position: relative;
		width: 100%;
		max-height: 92dvh;
		overflow: auto;
		border-radius: 22px 22px 0 0;
		padding: 10px 18px calc(20px + env(safe-area-inset-bottom));
		box-shadow: 0 -10px 40px var(--shadow);
		animation: up 0.18s ease-out;
	}
	.wide .sheet {
		width: var(--w);
		max-width: 100%;
		border-radius: 18px;
		padding: 18px 22px 22px;
		box-shadow: 0 20px 60px var(--shadow);
		animation: none;
	}
	@keyframes up {
		from {
			transform: translateY(30px);
			opacity: 0.6;
		}
	}
	.grip {
		width: 36px;
		height: 4px;
		border-radius: 2px;
		background: var(--border2);
		margin: 0 auto 10px;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 14px;
	}
	.head h2 {
		font-size: 18px;
		font-weight: 650;
	}
	.x {
		min-height: 36px;
		padding: 0 8px;
		color: var(--muted);
	}
	.body {
		display: grid;
		gap: 14px;
	}
	.foot {
		display: flex;
		gap: 10px;
		margin-top: 18px;
	}
	.foot :global(.btn) {
		flex: 1;
	}
</style>
