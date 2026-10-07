import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { changelogSection } from '../scripts/changelog-section.mjs';

const changelog = `# Changelog

## [Unreleased]

## [0.2.0] - 2026-10-08

### Added

- New feature.

## [0.1.0] - 2026-10-07

### Fixed

- A bug.

[Unreleased]: https://example.com/compare/0.2.0...HEAD
[0.2.0]: https://example.com/compare/0.1.0...0.2.0
[0.1.0]: https://example.com/releases/tag/0.1.0
`;

test('changelogSection returns the section body up to the next version', () => {
  assert.equal(changelogSection(changelog, '0.2.0'), '### Added\n\n- New feature.');
});

test('changelogSection stops the last section at the link definitions', () => {
  assert.equal(changelogSection(changelog, '0.1.0'), '### Fixed\n\n- A bug.');
});

test('changelogSection does not match a version that only shares a prefix', () => {
  assert.throws(() => changelogSection(changelog, '0.1'), /no "## \[0\.1\]" section/);
});

test('changelogSection rejects an empty section', () => {
  assert.throws(() => changelogSection(changelog, 'Unreleased'), /section of CHANGELOG\.md is empty/);
});

test('CHANGELOG.md has a section for the current package version', async () => {
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const markdown = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.match(changelogSection(markdown, version), /^### /);
});
