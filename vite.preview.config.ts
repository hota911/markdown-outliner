import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

// A static build of the web app on the files of samples/, kept in memory: dist/preview, for PR
// preview deployments. Asset paths are relative, so it works from any URL.
export default defineConfig({
  root: 'src/preview',
  base: './',
  plugins: [svelte({ configFile: path.join(rootDirectory, 'svelte.config.js') })],
  build: {
    outDir: path.join(rootDirectory, 'dist', 'preview'),
    emptyOutDir: true,
  },
});
