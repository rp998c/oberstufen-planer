<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<header>
	<a class="brand" href="/">Oberstufen-Planer</a>
	{#if data.authenticated && data.canLogout}
		<form method="POST" action="/logout">
			<button class="link" type="submit">Abmelden</button>
		</form>
	{/if}
</header>

<main>
	{@render children()}
</main>

<footer>Planungshilfe – verbindlich ist die Berechnung der Schule.</footer>
