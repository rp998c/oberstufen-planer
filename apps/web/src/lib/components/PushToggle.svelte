<script lang="ts">
	import { onMount } from 'svelte';

	let supported = $state(false);
	let subscribed = $state(false);
	let busy = $state(false);
	let message = $state('');

	function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
		const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
			.replace(/-/g, '+')
			.replace(/_/g, '/');
		const raw = atob(padded);
		const out = new Uint8Array(new ArrayBuffer(raw.length));
		for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
		return out;
	}

	onMount(async () => {
		supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
		if (!supported) return;
		const reg = await navigator.serviceWorker.getRegistration();
		subscribed = !!(await reg?.pushManager.getSubscription());
	});

	async function enable() {
		busy = true;
		message = '';
		try {
			if ((await Notification.requestPermission()) !== 'granted') {
				message = 'Benachrichtigungen wurden im Browser nicht erlaubt.';
				return;
			}
			const reg = await navigator.serviceWorker.ready;
			const { publicKey } = await (await fetch('/api/push')).json();
			const sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: keyToBytes(publicKey)
			});
			const res = await fetch('/api/push', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(sub.toJSON())
			});
			if (!res.ok) throw new Error(String(res.status));
			subscribed = true;
			message = 'Push-Benachrichtigungen sind auf diesem Gerät aktiv.';
		} catch (e) {
			console.error(e);
			message = 'Aktivieren fehlgeschlagen. Push braucht HTTPS (oder localhost).';
		} finally {
			busy = false;
		}
	}

	async function disable() {
		busy = true;
		const reg = await navigator.serviceWorker.getRegistration();
		const sub = await reg?.pushManager.getSubscription();
		if (sub) {
			await fetch('/api/push', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ endpoint: sub.endpoint })
			});
			await sub.unsubscribe();
		}
		subscribed = false;
		message = 'Push-Benachrichtigungen auf diesem Gerät deaktiviert.';
		busy = false;
	}
</script>

{#if !supported}
	<p class="muted">
		Dieser Browser unterstützt keine Push-Benachrichtigungen (auf dem iPhone: App erst zum
		Home-Bildschirm hinzufügen).
	</p>
{:else if subscribed}
	<button type="button" class="secondary" disabled={busy} onclick={disable}
		>Push auf diesem Gerät deaktivieren</button
	>
{:else}
	<button type="button" disabled={busy} onclick={enable}>Push auf diesem Gerät aktivieren</button>
{/if}
{#if message}<p class="muted" role="status">{message}</p>{/if}
