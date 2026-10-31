<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const items = $derived([
		{ href: '/stundenplan', icon: '🗓️', label: 'Stundenplan', hint: 'Deine Woche' },
		{
			href: '/aufgaben',
			icon: '✅',
			label: 'Aufgaben',
			hint: data.openTasks ? `${data.openTasks} offen` : 'Alles erledigt'
		},
		{
			href: '/ziele',
			icon: '🎯',
			label: 'Lernziele',
			hint: data.openGoals ? `${data.openGoals} aktiv` : 'Ziele setzen'
		},
		{ href: '/faecher', icon: '📚', label: 'Fächer', hint: 'Fächerwahl ändern' },
		{
			href: '/zusammenfassung',
			icon: '🖨️',
			label: 'Zusammenfassung',
			hint: 'Drucken oder als PDF'
		},
		{
			href: '/einstellungen',
			icon: '⚙️',
			label: 'Einstellungen',
			hint: 'Notenarten, Erinnerungen, Daten'
		}
	]);
</script>

<svelte:head><title>Mehr · Oberstufen-Planer</title></svelte:head>

<h1>Mehr</h1>
<div class="items">
	{#each items as item (item.href)}
		<a class="card item" href={item.href}>
			<span class="icon" aria-hidden="true">{item.icon}</span>
			<span>
				<strong>{item.label}</strong>
				<small class="muted">{item.hint}</small>
			</span>
		</a>
	{/each}
</div>

<style>
	.items {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.75rem;
	}
	.item {
		display: flex;
		gap: 0.8rem;
		align-items: center;
		color: var(--text);
		text-decoration: none;
	}
	.item small {
		display: block;
	}
	.icon {
		font-size: 1.6rem;
	}
</style>
