import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		'import.meta.env.PUBLIC_POCKETBASE_URL': JSON.stringify(process.env.PUBLIC_POCKETBASE_URL)
	},
	build: {
		// Enable parallel processing
		target: 'esnext',
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true
			}
		},
		// Optimize chunk splitting
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ['svelte', '@sveltejs/kit']
				}
			}
		},
		// Configure source maps for production
		sourcemap: false,
		// Enable CSS code splitting
		cssCodeSplit: true,
		// Optimize assets
		assetsInlineLimit: 4096,
		// Enable module preload
		modulePreload: true
	}
});
