import { stat } from 'node:fs/promises';
import path from 'node:path';
import { packagePlugin } from './package-plugin.mjs';

const vault = process.env.OBSIDIAN_VAULT;
if (!vault) {
  console.error('OBSIDIAN_VAULT is not set. Set it to the path of an Obsidian vault, e.g. OBSIDIAN_VAULT=~/Documents/vault npm run dev:plugin');
  process.exit(1);
}

const vaultPath = path.resolve(vault);
const config = path.join(vaultPath, '.obsidian');
if (!(await stat(config).then(entry => entry.isDirectory(), () => false))) {
  console.error(`${config} does not exist. OBSIDIAN_VAULT must point to a folder that Obsidian has opened as a vault.`);
  process.exit(1);
}

const output = path.join(config, 'plugins', 'markdown-outliner');
await packagePlugin(output, { watch: true });
console.log(`Watching sources; writing the plugin to ${output}`);
