import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [svelte()],
  // Svelte's browser build; the server build has no mount().
  resolve: {
    conditions: ['browser'],
    alias: { obsidian: fileURLToPath(new URL('test/obsidian-module.js', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    // The .mjs files in test/ use node:test and run with `npm run test:node`.
    include: ['test/ui/**/*.test.js', 'test/obsidian.test.js', 'test/tauri.test.js'],
    setupFiles: ['test/ui/setup.js'],
  },
});
