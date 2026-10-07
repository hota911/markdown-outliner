import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Copies the new package version into manifest.json and records it in versions.json.
// Run by the npm "version" script; npm sets npm_package_version to the bumped version.
export async function bumpVersion(version, dir = root) {
  if (!version) throw new Error('Specify the version (run through `npm version`).');
  const manifestPath = path.join(dir, 'manifest.json');
  const versionsPath = path.join(dir, 'versions.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const versions = JSON.parse(await readFile(versionsPath, 'utf8'));
  manifest.version = version;
  if (!(version in versions)) versions[version] = manifest.minAppVersion;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(versionsPath, `${JSON.stringify(versions, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await bumpVersion(process.env.npm_package_version);
}
