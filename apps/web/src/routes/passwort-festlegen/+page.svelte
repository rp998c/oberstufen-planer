<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthCard from '$lib/AuthCard.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Willkommen · Oberstufen-Planer</title></svelte:head>

<AuthCard
	title="Willkommen!"
	lead="Leg ein Passwort fest, mit dem du dich ab jetzt anmeldest – im Browser und in der App."
>
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
			<span>Passwort (mind. {data.minLength} Zeichen)</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="input"
				name="password"
				type="password"
				autocomplete="new-password"
				minlength={data.minLength}
				required
				autofocus
			/>
		</label>
		<label class="field">
			<span>Passwort wiederholen</span>
			<input
				class="input"
				name="repeat"
				type="password"
				autocomplete="new-password"
				minlength={data.minLength}
				required
			/>
		</label>
		{#if form?.error}<p class="error-text" role="alert">{form.error}</p>{/if}
		<button class="btn accent big" type="submit" disabled={submitting}>Passwort festlegen</button>
	</form>
	<p class="tiny muted hint">
		Passwort vergessen? Mit dem Befehl <code>reset-password</code> im Container lässt es sich zurücksetzen.
	</p>
</AuthCard>

<style>
	.hint {
		margin: 18px 0 0;
		line-height: 1.5;
	}
</style>
