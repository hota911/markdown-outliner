import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

// The page of the Mac app: dist/mac/web, copied into the app's Resources by scripts/build-mac.mjs.
export default defineConfig({
  root: 'src/mac',
  base: './',
  plugins: [svelte({ configFile: path.join(rootDirectory, 'svelte.config.js') })],
  build: {
    outDir: path.join(rootDirectory, 'dist', 'mac', 'web'),
    emptyOutDir: true,
  },
});
