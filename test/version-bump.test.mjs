import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bumpVersion } from '../scripts/version-bump.mjs';

test('bumpVersion updates manifest.json and versions.json with minAppVersion', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'outliner-version-'));
  await writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify({ id: 'x', version: '0.1.0', minAppVersion: '1.5.7' }, null, 2)}\n`);
  await writeFile(path.join(dir, 'versions.json'), `${JSON.stringify({ '0.1.0': '1.5.7' }, null, 2)}\n`);
  await bumpVersion('0.2.0', dir);
  assert.equal(
    await readFile(path.join(dir, 'manifest.json'), 'utf8'),
    `${JSON.stringify({ id: 'x', version: '0.2.0', minAppVersion: '1.5.7' }, null, 2)}\n`
  );
  assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'versions.json'), 'utf8')), { '0.1.0': '1.5.7', '0.2.0': '1.5.7' });
});
