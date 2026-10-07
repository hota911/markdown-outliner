import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { changelogSection } from '../scripts/changelog-section.mjs';

// The layout `changie merge` writes: each version ends with the link definition for its heading.
const changelog = `# Changelog

## [0.2.0] - 2026-10-08

### Added

- New feature.

[0.2.0]: https://example.com/compare/0.1.1...0.2.0

## [0.1.1] - 2026-10-07

[0.1.1]: https://example.com/compare/0.1.0...0.1.1

## [0.1.0] - 2026-10-07

### Fixed

- A bug.

[0.1.0]: https://example.com/releases/tag/0.1.0
`;

test('changelogSection returns the section body without its heading and link definition', () => {
  assert.equal(changelogSection(changelog, '0.2.0'), '### Added\n\n- New feature.');
});

test('changelogSection reads the last section', () => {
  assert.equal(changelogSection(changelog, '0.1.0'), '### Fixed\n\n- A bug.');
});

test('changelogSection does not match a version that only shares a prefix', () => {
  assert.throws(() => changelogSection(changelog, '0.1'), /no "## \[0\.1\]" section/);
});

test('changelogSection rejects an empty section', () => {
  assert.throws(() => changelogSection(changelog, '0.1.1'), /section of CHANGELOG\.md is empty/);
});

test('CHANGELOG.md has a section for the current package version', async () => {
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const markdown = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.match(changelogSection(markdown, version), /^### /);
});

// CHANGELOG.md is generated: edit the fragments in .changes/ and run `npx changie merge`.
test('CHANGELOG.md matches what changie merges from .changes', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const changie = fileURLToPath(new URL('../node_modules/changie/npm/changie.js', import.meta.url));
  const { stdout } = await promisify(execFile)(process.execPath, [changie, 'merge', '--dry-run'], { cwd: root });
  const markdown = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.equal(markdown, stdout, 'CHANGELOG.md differs from `npx changie merge --dry-run`.');
});
