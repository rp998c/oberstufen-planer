<script lang="ts">
	import { app } from '../lib/app.svelte.ts';

	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(t);
	});
	const ago = $derived.by(() => {
		if (!app.lastSync) return 'noch nie';
		const min = Math.round((now - app.lastSync) / 60_000);
		if (min < 1) return 'gerade eben';
		if (min < 60) return `vor ${min} Min.`;
		const h = Math.round(min / 60);
		return h < 24 ? `vor ${h} Std.` : new Date(app.lastSync).toLocaleDateString('de-DE');
	});
	const pending = $derived(app.queue.length);
</script>

<div class="sync small" aria-live="polite">
	{#if app.status === 'syncing'}
		<span>⟳ Synchronisiere …</span>
	{:else if app.status === 'offline'}
		<span class="warn">● Offline</span>
		<span class="muted">· zuletzt {ago}{pending ? ` · ${pending} Änderung(en) warten` : ''}</span>
	{:else if app.status === 'error'}
		<span class="warn">● Fehler beim Abgleich</span>
	{:else}
		<span class="okc">●</span>
		<span class="muted">Abgeglichen {ago}{pending ? ` · ${pending} Änderung(en) warten` : ''}</span>
	{/if}
	<button class="link" onclick={() => app.sync()} disabled={app.status === 'syncing'}>Jetzt</button>
</div>

<style>
	.sync {
		display: flex;
		gap: 0.35rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.sync button {
		margin-left: auto;
		padding: 0.2rem 0.4rem;
	}
	.warn {
		color: var(--danger);
		font-weight: 600;
	}
	.okc {
		color: var(--accent);
	}
</style>
