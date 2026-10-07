import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { posix } from 'node:path';
import vm from 'node:vm';

// These tests exercise the plugin boundary, not the native Obsidian application.
const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const core = require('../src/core.js');

async function fixture() {
  class TFile {
    constructor(path) { this.path = path; this.extension = path.split('.').at(-1); }
  }
  const files = new Map([
    ['TODO.md', '- ![[work.md]]\n'],
    ['work.md', '- [ ] embedded task\n'],
    ['notes.txt', 'plain text'],
    ['projects/plan.md', '- [ ] nested task\n'],
  ]);
  const folders = new Set(['projects', 'archive.md']);
  const reads = [], writes = [], mounts = [], notices = [];
  const vault = {
    getFileByPath: path => files.has(path) ? new TFile(path) : null,
    getFolderByPath: path => folders.has(path) ? { path } : null,
    getMarkdownFiles: () => [...files.keys()].filter(path => path.endsWith('.md')).map(path => new TFile(path)),
    read: async file => { reads.push(file.path); return files.get(file.path); },
    process: async (file, update) => {
      const changed = update(files.get(file.path));
      files.set(file.path, changed);
      writes.push(file.path);
      return changed;
    },
    create: async (path, text) => {
      if (files.has(path)) throw new Error('File already exists.');
      files.set(path, text);
      writes.push(path);
      return new TFile(path);
    },
  };
  const contentEl = { empty() {}, addClass() {} };
  const existing = [];
  const created = [], revealed = [], states = [], opened = [];
  const app = { vault, workspace: {
    getLeavesOfType: type => existing.filter(leaf => leaf.type === type),
    getLeaf: mode => {
      created.push(mode);
      const leaf = { app, type: null, setViewState: async state => { states.push(state); leaf.type = state.type; },
        openFile: async file => { opened.push(file.path); } };
      existing.push(leaf);
      return leaf;
    },
    revealLeaf: leaf => { revealed.push(leaf); },
  } };
  class ItemView {
    constructor(leaf) { this.app = leaf.app; this.contentEl = contentEl; }
  }
  class Plugin {
    constructor(app) { this.app = app; this.views = new Map(); this.commands = []; this.ribbons = []; }
    registerView(type, factory) { this.views.set(type, factory); }
    addCommand(command) { this.commands.push(command); }
    addRibbonIcon(icon, name, callback) { this.ribbons.push({ icon, name, callback }); }
    async loadData() { return { bookmarks: [] }; }
    async saveData(value) { this.savedData = structuredClone(value); }
  }
  class Notice { constructor(message) { notices.push(message); } }
  class Scope {
    register(modifiers, key, callback) { this.handler = callback; }
  }
  const ui = { mount: (element, options) => {
    const mounted = { element, options, destroyed: 0, completed: 0,
      completeActive() { this.completed++; return true; }, destroy() { this.destroyed++; } };
    mounts.push(mounted);
    return mounted;
  } };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, require: id => {
    if (id === 'obsidian') return { Plugin, ItemView, Notice, TFile, Scope, normalizePath: posix.normalize };
    if (id === './core.js') return core;
    if (id === './ui.js') return ui;
    throw new Error('Unexpected module: ' + id);
  } }, { filename: 'src/main.js' });
  const plugin = new module.exports(app);
  await plugin.onload();
  const view = plugin.views.get('markdown-outliner')({ app });
  await view.onOpen();
  return { plugin, view, adapter: mounts.at(-1).options.adapter, files, reads, writes, mounts, notices, existing, created, revealed, states, opened };
}

test('ブックマーク設定を View に渡し Markdown と別に保存する', async () => {
  const f = await fixture();
  const options = f.mounts.at(-1).options;
  options.preferences.bookmarks.push({ id: 'saved-search', kind: 'search', file: 'TODO.md', status: 'in-progress', tags: ['work'] });
  await options.savePreferences(options.preferences);
  assert.equal(f.plugin.savedData.bookmarks[0].status, 'in-progress');
  assert.deepEqual(f.writes, []);
  await f.view.onClose();
  await f.view.onOpen();
  assert.equal(f.mounts.at(-1).options.preferences.bookmarks[0].id, 'saved-search');
});

test('View の Enter ショートカットを編集画面へ渡し変換中は変更しない', async () => {
  const f = await fixture();
  let prevented = false;
  assert.equal(f.view.scope.handler({ preventDefault() { prevented = true; } }), false);
  assert.equal(prevented, true);
  assert.equal(f.mounts.at(-1).completed, 1);
  f.view.scope.handler({ isComposing: true });
  assert.equal(f.mounts.at(-1).completed, 1);
});

test('埋め込み先の公開 read/save で参照元ファイルを変更しない', async () => {
  const f = await fixture();
  const parent = await f.adapter.read('TODO.md');
  const embeddedPath = core.parse(parent.text)[0].embed;
  const child = await f.adapter.read(embeddedPath);
  const changed = core.updateStatus(child.text, 0, 'done').text;
  assert.equal((await f.adapter.save(embeddedPath, changed, child.revision)).revision, changed);
  assert.equal(f.files.get('TODO.md'), parent.text);
  assert.equal(f.files.get('work.md'), '- [x] embedded task\n');
  assert.deepEqual(f.writes, ['work.md']);
});

test('古い revision の保存を拒否し外部変更を保持する', async () => {
  const f = await fixture();
  const before = await f.adapter.read('work.md');
  f.files.set('work.md', '- [ ] changed by Coding Agent\n');
  await assert.rejects(f.adapter.save('work.md', '- [x] local edit\n', before.revision), /外部で変更/);
  assert.equal(f.files.get('work.md'), '- [ ] changed by Coding Agent\n');
  assert.deepEqual(f.writes, []);
  f.mounts[0].options.drafts.set('work.md', { text: '- [ ] unsaved\n', dirty: true });
  await f.adapter.openSource('work.md');
  assert.match(f.notices[0], /保存済みの内容/);
  assert.equal(f.files.get('work.md'), '- [ ] changed by Coding Agent\n');
});

test('Vault 内のどのフォルダーの Markdown も一覧に出し読み書きできる', async () => {
  const f = await fixture();
  assert.deepEqual(Array.from(await f.adapter.list()), ['TODO.md', 'projects/plan.md', 'work.md']);
  const nested = await f.adapter.read('projects/plan.md');
  assert.equal(nested.text, '- [ ] nested task\n');
  await f.adapter.save('projects/plan.md', '- [x] nested task\n', nested.revision);
  assert.equal(f.files.get('projects/plan.md'), '- [x] nested task\n');
  assert.deepEqual(f.writes, ['projects/plan.md']);
});

test('絶対パス・バックスラッシュ・親参照・非 Markdown・存在しないファイルの read/save を拒否する', async () => {
  const f = await fixture();
  await assert.rejects(f.adapter.read('/TODO.md'));
  await assert.rejects(f.adapter.save('/TODO.md', 'overwritten', '- ![[work.md]]\n'));
  await assert.rejects(f.adapter.read('C:\\TODO.md'));
  await assert.rejects(f.adapter.save('C:\\TODO.md', 'overwritten', '- ![[work.md]]\n'));
  await assert.rejects(f.adapter.read('projects\\plan.md'));
  await assert.rejects(f.adapter.save('projects\\plan.md', 'overwritten', '- [ ] nested task\n'));
  await assert.rejects(f.adapter.read('../TODO.md'));
  await assert.rejects(f.adapter.save('../TODO.md', 'overwritten', '- ![[work.md]]\n'));
  await assert.rejects(f.adapter.read('projects/../TODO.md'));
  await assert.rejects(f.adapter.save('projects/../TODO.md', 'overwritten', '- ![[work.md]]\n'));
  await assert.rejects(f.adapter.read('notes.txt'));
  await assert.rejects(f.adapter.save('notes.txt', 'overwritten', 'plain text'));
  await assert.rejects(f.adapter.read('missing.md'), /参照先の Markdown がありません/);
  await assert.rejects(f.adapter.save('missing.md', 'created', ''), /参照先の Markdown がありません/);
  assert.deepEqual(f.reads, []);
  assert.deepEqual(f.writes, []);
  assert.equal(f.files.get('TODO.md'), '- ![[work.md]]\n');
  assert.equal(f.files.get('notes.txt'), 'plain text');
  assert.equal(f.files.has('missing.md'), false);
});

test('新しい Markdown を Vault 内に作成し、既存ファイルと Vault 外は拒否する', async () => {
  const f = await fixture();
  assert.equal((await f.adapter.create('projects/new task.md', '- [ ] moved\n')).revision, '- [ ] moved\n');
  assert.equal((await f.adapter.read('projects/new task.md')).text, '- [ ] moved\n');
  await assert.rejects(f.adapter.create('work.md', 'overwritten\n'), /同じ名前/);
  await assert.rejects(f.adapter.create('archive.md', 'folder with the same name\n'), /同じ名前/);
  await assert.rejects(f.adapter.create('../outside.md', 'outside\n'));
  await assert.rejects(f.adapter.create('/outside.md', 'outside\n'));
  await assert.rejects(f.adapter.create('notes.md.txt', 'text\n'));
  assert.equal(f.files.get('work.md'), '- [ ] embedded task\n');
  assert.deepEqual(f.writes, ['projects/new task.md']);
});

test('View の再 Open と Close で以前の UI を破棄し再表示できる', async () => {
  const f = await fixture();
  const draft = { text: '- [ ] unsaved input\n', dirty: true };
  const drafts = f.mounts[0].options.drafts;
  drafts.set('work.md', draft);
  await f.view.onOpen();
  assert.equal(f.mounts[0].destroyed, 1);
  assert.equal(f.mounts[1].destroyed, 0);
  await f.view.onClose();
  assert.equal(f.mounts[1].destroyed, 1);
  assert.equal(f.view.mounted, null);
  await f.view.onOpen();
  assert.equal(f.mounts.length, 3);
  assert.equal(f.mounts[2].destroyed, 0);
  assert.equal(f.mounts[2].options.drafts, drafts);
  assert.equal(f.mounts[2].options.drafts.get('work.md'), draft);
  assert.equal(f.files.get('work.md'), '- [ ] embedded task\n');
  assert.match(f.notices[0], /未保存の入力を保持/);
  await f.view.onClose();
  await f.view.onClose();
  assert.equal(f.mounts[2].destroyed, 1);
});

test('通常エディターで開く操作も Vault 内の Markdown に限定する', async () => {
  const f = await fixture();
  await assert.rejects(f.adapter.openSource('../TODO.md'));
  await assert.rejects(f.adapter.openSource('/work.md'));
  await assert.rejects(f.adapter.openSource('notes.txt'));
  assert.deepEqual(f.created, []);
  assert.deepEqual(f.opened, []);
  await f.adapter.openSource('projects/plan.md');
  assert.deepEqual(f.created, ['tab']);
  assert.deepEqual(f.opened, ['projects/plan.md']);
  assert.deepEqual(f.writes, []);
});

test('登録コマンドとリボンが既存の View leaf を再利用する', async () => {
  const f = await fixture();
  assert.equal(f.plugin.commands.length, 1);
  assert.equal(f.plugin.commands[0].id, 'open-outliner');
  assert.equal(f.plugin.ribbons.length, 1);
  await f.plugin.commands[0].callback();
  await f.plugin.ribbons[0].callback();
  assert.deepEqual(f.created, ['tab']);
  assert.equal(f.states.length, 2);
  assert.equal(f.states[0].type, 'markdown-outliner');
  assert.equal(f.states[0].active, true);
  assert.equal(f.revealed[0], f.revealed[1]);
  assert.deepEqual(f.notices, []);
});
