import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// For testing in a desktop browser: DEV_SERVER=http://localhost:3000 pnpm dev
// proxies /api to that server, so the app can use its own origin as server address.
const devServer = process.env.DEV_SERVER;

export default defineConfig({
	plugins: [svelte()],
	base: './',
	build: { outDir: 'dist', target: 'es2022' },
	server: {
		fs: { allow: ['..', '../..'] },
		proxy: devServer ? { '/api': { target: devServer, changeOrigin: true } } : undefined
	},
	preview: {
		proxy: devServer ? { '/api': { target: devServer, changeOrigin: true } } : undefined
	}
});
