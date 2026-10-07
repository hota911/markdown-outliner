import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { packagePlugin, releaseAssets } from '../scripts/package-plugin.mjs';

test('packaged plugin loads with only the Obsidian external module', async () => {
  const output = await mkdtemp(path.join(tmpdir(), 'outliner-package-'));
  await packagePlugin(output, { quiet: true });
  assert.deepEqual((await readdir(output)).sort(), [...releaseAssets].sort());
  const commands = [];
  const views = [];
  class Plugin {
    app = { workspace: { on: () => ({}) }, vault: { on: () => ({}) } };
    async loadData() { return null; }
    registerEvent() {}
    registerView(type) { views.push(type); }
    addCommand(command) { commands.push(command); }
    addRibbonIcon() {}
  }
  const module = { exports: {} };
  vm.runInNewContext(await readFile(path.join(output, 'main.js'), 'utf8'), {
    module,
    require: name => {
      assert.equal(name, 'obsidian');
      // An Obsidian older than 1.8.7, which has no getLanguage().
      return { Plugin, ItemView: class {}, FileView: class {}, MarkdownView: class {}, TFile: class {}, Notice: class {}, Scope: class {}, normalizePath: value => value, requireApiVersion: () => false };
    }
  });
  await new module.exports().onload();
  assert.deepEqual(views, ['markdown-outliner', 'markdown-outliner-file']);
  assert.equal(commands[0].id, 'open-outliner');
  assert.equal(commands[0].name, 'Open outliner');
  assert.equal(commands[0].hotkeys, undefined);
});

test('manifest identity matches the release metadata', async () => {
  const root = new URL('../', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  const versions = JSON.parse(await readFile(new URL('versions.json', root), 'utf8'));
  const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert.equal(manifest.id, 'markdown-outliner');
  assert.equal(versions[manifest.version], manifest.minAppVersion);
  assert.equal(pkg.version, manifest.version);
  assert.doesNotMatch(manifest.description, /obsidian/i);
  assert.ok(manifest.description.length <= 250 && manifest.description.endsWith('.'));
});
