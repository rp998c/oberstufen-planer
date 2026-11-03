<script lang="ts">
	import { App, downloadFile, pickTextFile, type Platform } from '@oberstufen-planer/ui';

	const platform: Platform = {
		kind: 'web',
		sameOriginServer: true,
		canPrint: true,
		async load(key, fallback) {
			try {
				const v = localStorage.getItem(key);
				return v === null ? fallback : JSON.parse(v);
			} catch {
				return fallback;
			}
		},
		async save(key, value) {
			try {
				localStorage.setItem(key, JSON.stringify(value));
			} catch {
				// storage full or blocked: the server still has everything
			}
		},
		async remove(key) {
			try {
				localStorage.removeItem(key);
			} catch {
				// ignore
			}
		},
		async saveFile(name, mime, content) {
			downloadFile(name, mime, content);
		},
		pickFile: pickTextFile,
		onUnauthorized() {
			location.href = '/login';
		}
	};
</script>

<svelte:head><title>Oberstufen-Planer</title></svelte:head>

<App {platform} />
