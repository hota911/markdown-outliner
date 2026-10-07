import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const defaultOutput = path.join(root, 'dist');
export const releaseAssets = ['main.js', 'manifest.json', 'styles.css'];

const staticAssets = [
  [path.join(root, 'manifest.json'), 'manifest.json'],
  [path.join(root, 'src', 'styles.css'), 'styles.css'],
];

// Copies manifest.json and styles.css next to main.js after every bundle. They are also watched,
// so editing either one in watch mode triggers a rebuild that copies it again.
function copyStaticAssets(output) {
  return {
    name: 'copy-plugin-assets',
    buildStart() {
      for (const [source] of staticAssets) this.addWatchFile(source);
    },
    async closeBundle() {
      for (const [source, name] of staticAssets) await copyFile(source, path.join(output, name));
    },
  };
}

// Builds main.js with vite.config.ts and puts the release assets next to it. With `watch`, keeps
// rebuilding on source changes and resolves to the watcher instead of waiting for it to finish.
export async function packagePlugin(output = defaultOutput, { quiet = false, watch = false } = {}) {
  if (!path.isAbsolute(output)) throw new Error('Specify an absolute output directory.');
  await mkdir(output, { recursive: true });
  const result = await build({
    configFile: path.join(root, 'vite.config.ts'),
    root,
    logLevel: quiet ? 'warn' : 'info',
    plugins: [copyStaticAssets(output)],
    build: { outDir: output, watch: watch ? {} : null },
  });
  return watch ? result : output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const output = await packagePlugin(process.argv[2] ? path.resolve(process.argv[2]) : defaultOutput);
  console.log(`Plugin package prepared: ${output} (${releaseAssets.join(', ')})`);
}
