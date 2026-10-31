<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Anmelden · Oberstufen-Planer</title></svelte:head>

<section class="card login">
	<h1>Anmelden</h1>
	<form
		method="POST"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<label for="password">Passwort</label>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			id="password"
			name="password"
			type="password"
			autocomplete="current-password"
			required
			autofocus
		/>
		{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
		<button type="submit" disabled={submitting}>{submitting ? 'Prüfe …' : 'Anmelden'}</button>
	</form>
</section>

<style>
	.login {
		max-width: 22rem;
		margin: 4rem auto;
	}
	form {
		display: grid;
		gap: 0.75rem;
	}
	.error {
		color: var(--danger);
		margin: 0;
	}
</style>
