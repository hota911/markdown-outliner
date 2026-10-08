import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Returns the body of the `## [<version>]` section of a Keep a Changelog file, without its
// heading. The section ends at the next `## ` heading or at a link definition, which `changie merge`
// writes at the end of each version.
// Throws if the section is missing or has no entries, so a release never goes out without notes.
export function changelogSection(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const heading = `## [${version}]`;
  const start = lines.findIndex(line => line === heading || line.startsWith(`${heading} `));
  if (start === -1) throw new Error(`CHANGELOG.md has no "${heading}" section.`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(line => line.startsWith('## ') || /^\[[^\]]+\]: /.test(line));
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  if (!body) throw new Error(`The "${heading}" section of CHANGELOG.md is empty.`);
  return body;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version) throw new Error('Usage: node scripts/changelog-section.mjs <version>');
  process.stdout.write(`${changelogSection(await readFile(path.join(root, 'CHANGELOG.md'), 'utf8'), version)}\n`);
}
