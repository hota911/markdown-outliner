import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import * as core from '../src/core.ts';
import { TFile } from 'obsidian';
import MarkdownOutlinerPlugin from '../src/obsidian/main.ts';

// These tests exercise the plugin boundary, not the native Obsidian application.
// fixture() replaces these arrays per test; the mocks below push into them.
const state = vi.hoisted(() => ({ notices: [], mounts: [], language: 'ja' }));

vi.mock('obsidian', async () => {
  const { posix } = await import('node:path');
  class TFile {
    constructor(path) { this.path = path; this.extension = path.split('.').at(-1); this.basename = posix.basename(path, '.' + this.extension); }
  }
  class ItemView {
    constructor(leaf) { this.leaf = leaf; this.app = leaf.app; this.contentEl = leaf.app.contentEl; }
    async onOpen() {}
    async onClose() {}
    async setState() {}
    onPaneMenu() {}
  }
  // Like Obsidian's FileView: the view state carries the file path, and loading a file unloads the previous one.
  class FileView extends ItemView {
    file = null;
    getDisplayText() { return this.file ? this.file.basename : ''; }
    getState() { return this.file ? { file: this.file.path } : {}; }
    async onRename() {}
    async setState(viewState) {
      const file = this.app.vault.getFileByPath(viewState.file);
      if (this.file) await this.onUnloadFile(this.file);
      this.file = file;
      await this.onLoadFile(file);
    }
  }
  class MarkdownView extends FileView { getViewType() { return 'markdown'; } }
  class Plugin {
    constructor(app) { this.app = app; this.views = new Map(); this.commands = []; this.ribbons = []; }
    registerView(type, factory) { this.views.set(type, factory); }
    registerEvent() {}
    addCommand(command) { this.commands.push(command); }
    addRibbonIcon(icon, name, callback) { this.ribbons.push({ icon, name, callback }); }
    async loadData() { return { bookmarks: [] }; }
    async saveData(value) { this.savedData = structuredClone(value); }
  }
  class Notice { constructor(message) { state.notices.push(message); } }
  class Scope {
    register(modifiers, key, callback) { this.handler = callback; }
  }
  // The existing tests run with Obsidian set to Japanese; fixture() can choose another language.
  // Like Obsidian's getAllTags: the tags of the text and of the frontmatter, written with `#`.
  const getAllTags = cache => [...(cache.tags ?? []).map(({ tag }) => tag), ...(cache.frontmatter?.tags ?? []).map(tag => '#' + tag)];
  return { Plugin, ItemView, FileView, MarkdownView, TFile, Notice, Scope, getAllTags, normalizePath: posix.normalize,
    getLanguage: () => state.language, requireApiVersion: () => true };
});

// Collects the items a menu callback adds.
function menu() {
  const items = [];
  return {
    items,
    addItem(build) {
      const item = { setTitle(title) { this.title = title; return this; }, setIcon(icon) { this.icon = icon; return this; },
        onClick(callback) { this.click = callback; return this; } };
      build(item);
      items.push(item);
      return this;
    },
  };
}

vi.mock('../src/ui/mount.ts', () => ({
  mountOutliner: (element, options) => {
    const mounted = { element, options, destroyed: 0, completed: 0,
      completeActive() { this.completed++; return true; }, destroy() { this.destroyed++; } };
    state.mounts.push(mounted);
    return mounted;
  },
}));

async function fixture({ language = 'ja' } = {}) {
  state.language = language;
  const files = new Map([
    ['TODO.md', '- ![[work.md]]\n'],
    ['work.md', '- [ ] embedded task\n'],
    ['notes.txt', 'plain text'],
    ['projects/plan.md', '- [ ] nested task\n'],
  ]);
  const folders = new Set(['projects', 'archive.md']);
  const reads = [], writes = [], mounts = [], notices = [];
  state.mounts = mounts;
  state.notices = notices;
  const renames = [];
  const vault = {
    on: (name, callback) => { if (name === 'rename') renames.push(callback); },
    // Like Vault#rename: moves the content, updates the TFile, then notifies views and listeners.
    rename: async (file, newPath, views) => {
      const oldPath = file.path;
      files.set(newPath, files.get(oldPath));
      files.delete(oldPath);
      file.path = newPath;
      file.basename = newPath.split('/').at(-1).replace(/\.md$/, '');
      for (const view of views) await view.onRename(file);
      for (const callback of renames) callback(file, oldPath);
    },
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
  // Files without an entry have no cache yet, as right after Obsidian starts.
  const caches = new Map([
    ['work.md', { tags: [{ tag: '#work' }, { tag: '#仕事/進行中' }] }],
    ['projects/plan.md', { frontmatter: { tags: ['plan'] } }],
  ]);
  const metadataCache = { getFileCache: file => caches.get(file.path) ?? null };
  const contentEl = { empty() {}, addClass() {} };
  const existing = [];
  const created = [], revealed = [], states = [], opened = [], fileMenus = [];
  let plugin = null, activeView = null;
  // Like WorkspaceLeaf#setViewState: closes the current view and opens one of the new type.
  const newLeaf = () => {
    const leaf = { app, type: null, view: null,
      setViewState: async viewState => {
        states.push(viewState);
        await leaf.view?.onClose();
        leaf.type = viewState.type;
        leaf.view = plugin.views.get(viewState.type)?.(leaf) ?? null;
        await leaf.view?.onOpen();
        await leaf.view?.setState(viewState.state ?? {}, {});
      },
      openFile: async file => { opened.push(file.path); } };
    return leaf;
  };
  const app = { vault, metadataCache, contentEl, workspace: {
    getLeavesOfType: type => existing.filter(leaf => leaf.type === type),
    getLeaf: mode => {
      created.push(mode);
      const leaf = newLeaf();
      existing.push(leaf);
      return leaf;
    },
    revealLeaf: leaf => { revealed.push(leaf); },
    getActiveViewOfType: type => activeView instanceof type ? activeView : null,
    on: (name, callback) => { if (name === 'file-menu') fileMenus.push(callback); },
  } };
  plugin = new MarkdownOutlinerPlugin(app);
  await plugin.onload();
  const view = plugin.views.get('markdown-outliner')({ app });
  await view.onOpen();
  const setActiveView = value => { activeView = value; };
  return { plugin, view, adapter: mounts.at(-1).options.adapter, files, reads, writes, mounts, notices, existing, created, revealed, states, opened,
    fileMenus, newLeaf, setActiveView };
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

test('Vault の全 Markdown のタグを # なしで返す', async () => {
  const f = await fixture();
  assert.deepEqual([...await f.adapter.tags()].sort(), ['plan', 'work', '仕事/進行中']);
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
  assert.deepEqual(f.plugin.commands.map(command => command.id), ['open-outliner', 'open-file-as-outline']);
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

test('Obsidian の表示言語でコマンド名・表示名・エラーを切り替える', async () => {
  const ja = await fixture();
  assert.equal(ja.plugin.commands[0].name, 'アウトライナーを開く');
  assert.equal(ja.plugin.ribbons[0].name, 'アウトライナーを開く');
  assert.equal(ja.view.getDisplayText(), 'Markdown Outliner');
  assert.equal(ja.mounts.at(-1).options.language, 'ja');

  const en = await fixture({ language: 'en' });
  assert.equal(en.plugin.commands[0].name, 'Open outliner');
  assert.equal(en.plugin.ribbons[0].name, 'Open outliner');
  assert.equal(en.view.getDisplayText(), 'Markdown Outliner');
  assert.equal(en.mounts.at(-1).options.language, 'en');
  await assert.rejects(en.adapter.read('missing.md'), { message: 'The Markdown file does not exist.' });

  // Languages without a translation fall back to English.
  const fr = await fixture({ language: 'fr' });
  assert.equal(fr.plugin.commands[0].name, 'Open outliner');
});

test('ファイルメニューの「アウトラインで開く」は Markdown だけに出し、そのファイルのタブを開く', async () => {
  const f = await fixture();
  const forText = menu();
  f.fileMenus[0](forText, new TFile('notes.txt'), 'file-explorer-context-menu');
  f.fileMenus[0](forText, { path: 'projects' }, 'file-explorer-context-menu');
  assert.deepEqual(forText.items, []);

  const forMarkdown = menu();
  f.fileMenus[0](forMarkdown, new TFile('projects/plan.md'), 'file-explorer-context-menu');
  assert.deepEqual(forMarkdown.items.map(item => item.title), ['アウトラインで開く']);
  await forMarkdown.items[0].click();
  const leaf = f.existing.at(-1);
  assert.equal(leaf.type, 'markdown-outliner-file');
  assert.equal(leaf.view.getDisplayText(), 'plan');
  assert.equal(f.mounts.at(-1).options.initialFile, 'projects/plan.md');
  assert.deepEqual(f.notices, []);
});

test('ファイルのタブは View state のファイルを保存・復元し、埋め込み先も読み書きできる', async () => {
  const f = await fixture();
  const first = f.newLeaf();
  await first.setViewState({ type: 'markdown-outliner-file', state: { file: 'TODO.md' } });
  const saved = first.view.getState();
  assert.deepEqual(saved, { file: 'TODO.md' });

  // Obsidian restores a tab after a restart by setting the saved state on a new leaf.
  const restored = f.newLeaf();
  await restored.setViewState({ type: 'markdown-outliner-file', state: saved });
  assert.deepEqual(restored.view.getState(), { file: 'TODO.md' });
  assert.equal(restored.view.getDisplayText(), 'TODO');
  const adapter = f.mounts.at(-1).options.adapter;
  assert.equal(f.mounts.at(-1).options.initialFile, 'TODO.md');
  const child = await adapter.read('work.md');
  await adapter.save('work.md', '- [x] embedded task\n', child.revision);
  assert.equal(f.files.get('work.md'), '- [x] embedded task\n');
  await assert.rejects(adapter.save('work.md', '- [ ] stale\n', child.revision), /外部で変更/);
});

test('アウトラインのタブのメニュー「Markdown で開く」で同じタブを Markdown 表示に切り替える', async () => {
  const f = await fixture();
  const leaf = f.newLeaf();
  await leaf.setViewState({ type: 'markdown-outliner-file', state: { file: 'projects/plan.md' } });
  const outline = f.mounts.at(-1);
  const paneMenu = menu();
  leaf.view.onPaneMenu(paneMenu, 'more-options');
  assert.deepEqual(paneMenu.items.map(item => item.title), ['Markdown で開く']);
  await paneMenu.items[0].click();
  assert.equal(leaf.type, 'markdown');
  assert.deepEqual(f.states.at(-1).state, { file: 'projects/plan.md' });
  assert.equal(outline.destroyed, 1);
});

test('コマンドはアクティブな Markdown エディターの同じタブをアウトラインに切り替える', async () => {
  const f = await fixture();
  const command = f.plugin.commands.find(value => value.id === 'open-file-as-outline');
  assert.equal(command.name, 'アウトラインで開く');
  assert.equal(command.checkCallback(true), false);

  const leaf = f.newLeaf();
  const { MarkdownView } = await import('obsidian');
  const editor = new MarkdownView(leaf);
  editor.file = new TFile('work.md');
  f.setActiveView(editor);
  assert.equal(command.checkCallback(true), true);
  assert.equal(f.states.length, 0);
  command.checkCallback(false);
  await vi.waitFor(() => assert.equal(leaf.type, 'markdown-outliner-file'));
  assert.deepEqual(leaf.view.getState(), { file: 'work.md' });
});

test('未保存の入力はタブを閉じても保持して次に開いたタブへ渡し、同時に開いたタブとは共有しない', async () => {
  const f = await fixture();
  const leaf = f.newLeaf();
  await leaf.setViewState({ type: 'markdown-outliner-file', state: { file: 'TODO.md' } });
  const draft = { text: '- [ ] unsaved\n', dirty: true };
  f.mounts.at(-1).options.drafts.set('TODO.md', draft);
  await leaf.view.onClose();
  assert.match(f.notices[0], /未保存の入力を保持/);

  const reopened = f.newLeaf();
  await reopened.setViewState({ type: 'markdown-outliner-file', state: { file: 'TODO.md' } });
  assert.equal(f.mounts.at(-1).options.drafts.get('TODO.md'), draft);
  const second = f.newLeaf();
  await second.setViewState({ type: 'markdown-outliner-file', state: { file: 'TODO.md' } });
  assert.equal(f.mounts.at(-1).options.drafts.has('TODO.md'), false);
  assert.equal(f.files.get('TODO.md'), '- ![[work.md]]\n');
});

test('リンクのメニューから開くとリンク元のタブを残し、タブ自身のメニューからは同じタブを切り替える', async () => {
  const f = await fixture();
  const { MarkdownView } = await import('obsidian');
  const noteLeaf = f.newLeaf();
  await noteLeaf.setViewState({ type: 'markdown', state: { file: 'TODO.md' } });
  noteLeaf.view = new MarkdownView(noteLeaf);
  noteLeaf.view.file = new TFile('TODO.md');

  // Obsidian passes the leaf that contains the link, which shows TODO.md, not work.md.
  const linkMenu = menu();
  f.fileMenus[0](linkMenu, new TFile('work.md'), 'link-context-menu', noteLeaf);
  await linkMenu.items[0].click();
  assert.equal(noteLeaf.type, 'markdown');
  assert.deepEqual(f.created, ['tab']);
  assert.equal(f.existing.at(-1).type, 'markdown-outliner-file');
  assert.deepEqual(f.existing.at(-1).view.getState(), { file: 'work.md' });

  const tabMenu = menu();
  f.fileMenus[0](tabMenu, new TFile('TODO.md'), 'tab-header', noteLeaf);
  await tabMenu.items[0].click();
  assert.deepEqual(f.created, ['tab']);
  assert.equal(noteLeaf.type, 'markdown-outliner-file');
  assert.deepEqual(noteLeaf.view.getState(), { file: 'TODO.md' });

  // The outline tab's own menu has "Open as Markdown" instead.
  const outlineMenu = menu();
  f.fileMenus[0](outlineMenu, new TFile('TODO.md'), 'more-options', noteLeaf);
  assert.deepEqual(outlineMenu.items, []);
});

test('開いているファイルの名前を変えても未保存の入力を表示したまま新しいパスへ保存できる', async () => {
  const f = await fixture();
  const leaf = f.newLeaf();
  await leaf.setViewState({ type: 'markdown-outliner-file', state: { file: 'TODO.md' } });
  const before = f.mounts.at(-1);
  const read = await before.options.adapter.read('TODO.md');
  const draft = { text: '- [ ] unsaved\n', baseRevision: read.revision, dirty: true, conflict: false };
  before.options.drafts.set('TODO.md', draft);

  await f.plugin.app.vault.rename(leaf.view.file, 'projects/renamed.md', [leaf.view]);
  const after = f.mounts.at(-1);
  assert.equal(before.destroyed, 1);
  assert.equal(after.options.initialFile, 'projects/renamed.md');
  assert.equal(after.options.drafts.get('projects/renamed.md'), draft);
  assert.equal(after.options.drafts.has('TODO.md'), false);
  assert.deepEqual(leaf.view.getState(), { file: 'projects/renamed.md' });
  await after.options.adapter.save('projects/renamed.md', draft.text, draft.baseRevision);
  assert.equal(f.files.get('projects/renamed.md'), '- [ ] unsaved\n');
});

test('閉じたタブの未保存の入力は名前を変えたファイルを開き直したタブへ渡す', async () => {
  const f = await fixture();
  const leaf = f.newLeaf();
  await leaf.setViewState({ type: 'markdown-outliner-file', state: { file: 'TODO.md' } });
  const draft = { text: '- [ ] unsaved\n', dirty: true };
  f.mounts.at(-1).options.drafts.set('TODO.md', draft);
  const file = leaf.view.file;
  await leaf.view.onClose();

  await f.plugin.app.vault.rename(file, 'renamed.md', []);
  const reopened = f.newLeaf();
  await reopened.setViewState({ type: 'markdown-outliner-file', state: { file: 'renamed.md' } });
  assert.equal(f.mounts.at(-1).options.drafts.get('renamed.md'), draft);
});
