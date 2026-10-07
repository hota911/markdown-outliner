import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';
import { createOutlinerApi } from './server.mjs';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

// Dev server only: mounts the same file API as server.mjs and injects its session config.
// The workspace is OUTLINER_WORKSPACE (a folder or one Markdown file), defaulting to samples/.
function outlinerApi(): Plugin {
  let api: Awaited<ReturnType<typeof createOutlinerApi>>;
  return {
    name: 'outliner-api',
    apply: 'serve',
    async configureServer(server) {
      api = await createOutlinerApi(process.env.OUTLINER_WORKSPACE || path.join(rootDirectory, 'samples'));
      server.middlewares.use((request, response, next) => {
        api.handle(request, response).then(handled => { if (!handled) next(); }, next);
      });
    },
    transformIndexHtml: html => api.injectConfig(html),
  };
}

// Standalone web app: dist/web, served by `npm start` (server.mjs).
export default defineConfig({
  root: 'src/web',
  base: './',
  plugins: [svelte({ configFile: path.join(rootDirectory, 'svelte.config.js') }), outlinerApi()],
  build: {
    outDir: path.join(rootDirectory, 'dist', 'web'),
    emptyOutDir: true,
  },
  // The API's Host check accepts 127.0.0.1 only.
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
