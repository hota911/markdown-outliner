import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

// The page of the desktop app: dist/tauri, embedded by `cargo tauri build` (src-tauri/tauri.conf.json).
export default defineConfig({
  root: 'src/tauri',
  base: './',
  plugins: [svelte({ configFile: path.join(rootDirectory, 'svelte.config.js') })],
  build: {
    outDir: path.join(rootDirectory, 'dist', 'tauri'),
    emptyOutDir: true,
  },
  // `npm run tauri:dev` loads the page from here (devUrl in tauri.conf.json).
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
});
