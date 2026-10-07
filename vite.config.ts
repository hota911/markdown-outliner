import { builtinModules } from 'node:module';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// Provided by Obsidian at runtime, so they must not be bundled.
const external = [
  'obsidian',
  'electron',
  /^@codemirror\//,
  /^@lezer\//,
  ...builtinModules,
  ...builtinModules.map(name => 'node:' + name),
];

// Obsidian plugin build: a single CommonJS main.js. scripts/package-plugin.mjs adds the
// manifest and styles.css next to it.
export default defineConfig({
  plugins: [svelte()],
  // Library mode does not replace this by itself; Svelte's runtime reads it.
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    copyPublicDir: false,
    sourcemap: false,
    lib: {
      entry: 'src/main.ts',
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rolldownOptions: {
      external,
      // Obsidian expects module.exports to be the plugin class.
      output: { exports: 'default' },
    },
  },
});
