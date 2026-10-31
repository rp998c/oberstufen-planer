<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Willkommen · Oberstufen-Planer</title></svelte:head>

<section class="card welcome">
	<h1>Willkommen!</h1>
	<p class="muted">
		Lege ein Passwort fest, mit dem du dich ab jetzt anmeldest – auf allen deinen Geräten.
	</p>
	<form
		method="POST"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
		class="stack"
	>
		<div class="field">
			<label for="password">Passwort (mind. {data.minLength} Zeichen)</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="new-password"
				minlength={data.minLength}
				required
				autofocus
			/>
		</div>
		<div class="field">
			<label for="repeat">Passwort wiederholen</label>
			<input
				id="repeat"
				name="repeat"
				type="password"
				autocomplete="new-password"
				minlength={data.minLength}
				required
			/>
		</div>
		{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
		<button type="submit" disabled={submitting}>Passwort festlegen</button>
	</form>
	<p class="muted small">
		Passwort vergessen? Mit dem Befehl <code>reset-password</code> im Container lässt es sich zurücksetzen.
	</p>
</section>

<style>
	.welcome {
		max-width: 24rem;
		margin: 3rem auto;
	}
	.small {
		font-size: 0.85rem;
		margin-bottom: 0;
	}
</style>
