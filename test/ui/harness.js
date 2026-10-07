import { afterEach, expect } from 'vitest';
import { waitFor, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { messages } from '../../src/ui/messages.ts';
import { mountOutliner } from '../../src/ui/mount.ts';

// In-memory stand-in for the web server / Obsidian vault adapters.
// Revisions are counters so that any external write, even with equal text, is detected.
// `rewriteLinks` mimics Obsidian's link update on rename, which writes the link without `.md`.
export function memoryAdapter(initial, { canCreate = true, rewriteLinks = false } = {}) {
  const files = new Map(Object.entries(initial));
  const revisions = new Map([...files.keys()].map(path => [path, 1]));
  const saves = [];
  const bump = path => { revisions.set(path, (revisions.get(path) || 0) + 1); return revisions.get(path); };
  const adapter = {
    files,
    saves,
    async list() { return [...files.keys()]; },
    async read(path) {
      if (!files.has(path)) throw new Error('ファイルがありません: ' + path);
      return { text: files.get(path), revision: revisions.get(path) };
    },
    async save(path, text, revision) {
      if (revisions.get(path) !== revision) throw new Error('外部で変更されています。');
      files.set(path, text);
      saves.push(path);
      return { revision: bump(path) };
    },
    // Simulates another editor or a coding agent changing the file on disk.
    externalWrite(path, text) {
      files.set(path, text);
      bump(path);
    },
  };
  if (canCreate) {
    adapter.create = async (path, text) => {
      if (files.has(path)) throw new Error('すでにあります: ' + path);
      files.set(path, text);
      return { revision: bump(path) };
    };
    adapter.rename = async (path, newPath) => {
      if (!files.has(path)) throw new Error('ファイルがありません: ' + path);
      if (files.has(newPath)) throw new Error('すでにあります: ' + newPath);
      files.set(newPath, files.get(path));
      revisions.set(newPath, revisions.get(path));
      files.delete(path);
      revisions.delete(path);
      if (!rewriteLinks) return;
      const name = file => file.split('/').pop();
      for (const [file, text] of files) {
        const next = text.split('![[' + name(path) + ']]').join('![[' + name(newPath).replace(/\.md$/, '') + ']]');
        if (next !== text) { files.set(file, next); bump(file); }
      }
    };
  }
  return adapter;
}

const mounted = [];
afterEach(() => {
  for (const { app, container } of mounted.splice(0)) {
    app.destroy();
    container.remove();
  }
});

// Mounts the UI on an in-memory vault and waits until the initial file is shown.
// Existing tests are written against the Japanese UI, so Japanese is the default here.
// `initialFile: null` mounts without an initial file, as the Obsidian view and a folder server do.
export async function setup(initial, { initialFile = 'tasks.md', canCreate, rewriteLinks, language = 'ja', preferences = { bookmarks: [] }, savePreferences } = {}) {
  const t = messages[language];
  const adapter = memoryAdapter(initial, { canCreate, rewriteLinks });
  const container = document.createElement('div');
  document.body.append(container);
  const app = mountOutliner(container, { adapter, initialFile: initialFile ?? undefined, language, preferences, savePreferences });
  mounted.push({ app, container });
  const screen = within(container);
  await waitFor(() => expect(screen.queryByText(t.opening)).toBeNull());
  const user = userEvent.setup();
  return {
    adapter,
    app,
    container,
    screen,
    user,
    titles: () => screen.queryAllByRole('textbox', { name: t.item.title }),
    titleValues: () => screen.queryAllByRole('textbox', { name: t.item.title }).map(node => node.value),
    title: value => screen.getAllByRole('textbox', { name: t.item.title }).find(node => node.value === value),
    row: value => within(screen.getAllByRole('textbox', { name: t.item.title }).find(node => node.value === value).closest('.outline-item')),
    // Saves through the toolbar button and returns the file content on "disk".
    async saved(path = initialFile) {
      await user.click(screen.getByRole('button', { name: t.toolbar.save }));
      await waitFor(() => expect(container.querySelector('.save-state').textContent).toBe(t.saveState.saved));
      return adapter.files.get(path);
    },
  };
}

// Lets pending adapter promises (poll, load) settle.
export const flush = () => new Promise(resolve => setTimeout(resolve, 20));
