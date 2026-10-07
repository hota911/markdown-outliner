import { defineConfig, globalIgnores } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

// Code that runs in Node (web server, build scripts, configs, tests), not in the plugin.
const nodeFiles = ['server.mjs', 'scripts/**', 'test/**', '*.config.{js,mjs,ts}'];

export default defineConfig([
  globalIgnores(['dist/', 'node_modules/', 'package-lock.json']),
  ...obsidianmd.configs.recommended,
  // The Svelte rules need a JavaScript AST, so they must not run on the JSON files.
  ...svelte.configs.recommended.map(config => ({ files: ['**/*.{js,mjs,ts,svelte}'], ...config })),
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, svelteConfig },
    },
    // The core rule reports parameter names inside TypeScript function types.
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: { 'no-unused-vars': 'off', '@typescript-eslint/no-unused-vars': 'error' },
  },
  {
    // The controller re-renders through its `version` counter (see render()), so its Maps and
    // Sets are deliberately plain collections rather than SvelteMap / SvelteSet.
    files: ['src/ui/controller.svelte.ts'],
    rules: { 'svelte/prefer-svelte-reactivity': 'off' },
  },
  {
    // Node-side code is not part of the Obsidian plugin, so the Obsidian rules (Node built-ins,
    // console output, plugin APIs) do not apply, and it is not in the type-checked project.
    files: nodeFiles,
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      ...Object.fromEntries(Object.keys(obsidianmd.rules).map(name => ['obsidianmd/' + name, 'off'])),
      'no-restricted-globals': 'off',
    },
  },
  {
    // The standalone web page runs in a browser, where Obsidian's requestUrl and
    // App#saveLocalStorage do not exist.
    files: ['src/web/**'],
    rules: { 'no-restricted-globals': 'off' },
  },
]);
