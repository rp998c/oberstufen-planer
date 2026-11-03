<script lang="ts">
	import Icon from '../components/Icon.svelte';
	import Logo from '../components/Logo.svelte';
	import { router } from '../lib/router.svelte.ts';
	import { store } from '../lib/store.svelte.ts';

	function start() {
		store.savePrefs({ started: true });
		router.go({ name: 'setup' });
	}
	function server() {
		store.savePrefs({ started: true });
		router.go({ name: 'settings' });
	}
	const points = [
		'Funktioniert komplett offline',
		'Erinnerungen an Klausuren direkt aufs Handy',
		'Sicherung als Datei – jederzeit'
	];
</script>

<div class="start">
	<Logo size={72} icon={store.prefs.icon} />
	<h1>Deine Noten.<br />Dein Abi-Schnitt.</h1>
	<p class="lead">
		Alles bleibt auf diesem Handy. Kein Konto, kein Server nötig – in 3 Minuten eingerichtet.
	</p>
	<ul>
		{#each points as p (p)}<li>
				<span class="ok"><Icon name="check" size={16} stroke={2.4} /></span>{p}
			</li>{/each}
	</ul>
	<div class="grow"></div>
	<button class="btn accent big go" type="button" onclick={start}>Los geht's</button>
	<button class="linkbtn srv" type="button" onclick={server}>Mit eigenem Server verbinden</button>
	<p class="tiny muted c">Sync ist optional – auch später in den Einstellungen.</p>
</div>

<style>
	.start {
		min-height: 100dvh;
		max-width: 480px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		padding: calc(80px + env(safe-area-inset-top)) 24px calc(28px + env(safe-area-inset-bottom));
	}
	h1 {
		margin-top: 28px;
		font-size: 30px;
		line-height: 1.15;
	}
	.lead {
		margin: 12px 0 0;
		font-size: 16px;
		line-height: 1.5;
		color: var(--muted);
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 32px 0 0;
		display: grid;
		gap: 12px;
	}
	li {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 14px;
		color: var(--text2);
	}
	.ok {
		width: 32px;
		height: 32px;
		border-radius: 10px;
		background: var(--tint);
		color: var(--accent);
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
	}
	.grow {
		flex: 1;
		min-height: 32px;
	}
	.go {
		min-height: 54px;
		border-radius: 14px;
		font-size: 16px;
	}
	.srv {
		align-self: center;
		margin-top: 8px;
		padding: 12px;
		font-size: 15px;
	}
	.c {
		text-align: center;
		margin: 2px 0 0;
	}
</style>
