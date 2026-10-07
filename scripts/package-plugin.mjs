import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src');
export const defaultOutput = path.join(root, 'dist');
export const releaseAssets = ['main.js', 'manifest.json', 'styles.css'];

// Bundles src/main.js with its local dependencies so the release main.js only requires 'obsidian'.
export async function packagePlugin(output = defaultOutput) {
  if (!path.isAbsolute(output)) throw new Error('Specify an absolute output directory.');
  let main = await readFile(path.join(source, 'main.js'), 'utf8');
  for (const name of ['core', 'ui']) {
    const code = await readFile(path.join(source, name + '.js'), 'utf8');
    const dependency = `const ${name} = require('./${name}.js');`;
    if (!main.includes(dependency)) throw new Error(`Missing package dependency: ${name}`);
    main = main.replace(dependency, () => `const ${name} = (() => { const module = { exports: {} };\n${code}\nreturn module.exports; })();`);
  }
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'main.js'), main);
  await copyFile(path.join(root, 'manifest.json'), path.join(output, 'manifest.json'));
  await copyFile(path.join(source, 'styles.css'), path.join(output, 'styles.css'));
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const output = await packagePlugin(process.argv[2] ? path.resolve(process.argv[2]) : defaultOutput);
  console.log(`Plugin package prepared: ${output} (${releaseAssets.join(', ')})`);
}
