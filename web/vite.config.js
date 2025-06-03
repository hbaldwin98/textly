import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		'import.meta.env.PUBLIC_POCKETBASE_URL': JSON.stringify(process.env.PUBLIC_POCKETBASE_URL)
	},
	build: {
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true
			}
		}
	}
});
