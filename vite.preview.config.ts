import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const page = 'markdown-outliner-preview.html';

// Moves the built script and stylesheet into the page, so the page is one file that works when
// opened directly (file://) or from a pull request's artifact. Fails the build on any other
// output, such as a second chunk or an image, which would need a file next to the page.
function inlineIntoPage(): Plugin {
  return {
    name: 'inline-into-page',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle[page];
      if (html?.type !== 'asset') throw new Error(`The build has no ${page}.`);
      let source = String(html.source);
      for (const [fileName, output] of Object.entries(bundle)) {
        if (fileName === page) continue;
        if (output.type === 'chunk' && fileName.endsWith('.js')) {
          // "</script" inside the code would end the inline script early.
          const code = output.code.replace(/<\/script/gi, '<\\/script');
          source = replaceOnce(source, `<script type="module" crossorigin src="./${fileName}"></script>`, `<script type="module">${code}</script>`);
        } else if (output.type === 'asset' && fileName.endsWith('.css')) {
          source = replaceOnce(source, `<link rel="stylesheet" crossorigin href="./${fileName}">`, `<style>${String(output.source)}</style>`);
        } else {
          throw new Error(`Cannot inline ${fileName} into ${page}.`);
        }
        delete bundle[fileName];
      }
      html.source = source;
    },
  };
}

function replaceOnce(source: string, tag: string, replacement: string): string {
  if (!source.includes(tag)) throw new Error(`${page} has no ${tag}.`);
  // A function, so "$" in the replacement is not read as a pattern.
  return source.replace(tag, () => replacement);
}

// A build of the web app on the files of samples/, kept in memory, as the single file
// dist/preview/markdown-outliner-preview.html for pull request previews.
export default defineConfig({
  root: 'src/preview',
  base: './',
  plugins: [svelte({ configFile: path.join(rootDirectory, 'svelte.config.js') }), inlineIntoPage()],
  build: {
    outDir: path.join(rootDirectory, 'dist', 'preview'),
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    rollupOptions: { input: path.join(rootDirectory, 'src', 'preview', page) },
  },
});
