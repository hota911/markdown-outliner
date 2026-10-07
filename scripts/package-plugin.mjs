import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const defaultOutput = path.join(root, 'dist');
export const releaseAssets = ['main.js', 'manifest.json', 'styles.css'];

// Builds main.js with vite.config.ts and puts the release assets next to it.
export async function packagePlugin(output = defaultOutput, { quiet = false } = {}) {
  if (!path.isAbsolute(output)) throw new Error('Specify an absolute output directory.');
  await mkdir(output, { recursive: true });
  await build({
    configFile: path.join(root, 'vite.config.ts'),
    root,
    logLevel: quiet ? 'warn' : 'info',
    build: { outDir: output },
  });
  await copyFile(path.join(root, 'manifest.json'), path.join(output, 'manifest.json'));
  await copyFile(path.join(root, 'src', 'styles.css'), path.join(output, 'styles.css'));
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const output = await packagePlugin(process.argv[2] ? path.resolve(process.argv[2]) : defaultOutput);
  console.log(`Plugin package prepared: ${output} (${releaseAssets.join(', ')})`);
}
