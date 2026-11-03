<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthCard from '$lib/AuthCard.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Anmelden · Oberstufen-Planer</title></svelte:head>

<AuthCard title="Anmelden">
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
		<label class="field">
			<span>Passwort</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="input"
				name="password"
				type="password"
				autocomplete="current-password"
				required
				autofocus
			/>
		</label>
		{#if form?.error}<p class="error-text" role="alert">{form.error}</p>{/if}
		<button class="btn accent big" type="submit" disabled={submitting}
			>{submitting ? 'Prüfe …' : 'Anmelden'}</button
		>
	</form>
</AuthCard>
