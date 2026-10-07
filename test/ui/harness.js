import { createRequire } from 'node:module';
import { afterEach, expect } from 'vitest';
import { waitFor, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

const require = createRequire(import.meta.url);
export const core = require('../../src/core.js');
const { mount } = require('../../src/ui.js');

// In-memory stand-in for the web server / Obsidian vault adapters.
// Revisions are counters so that any external write, even with equal text, is detected.
export function memoryAdapter(initial, { canCreate = true } = {}) {
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
export async function setup(initial, { initialFile = 'tasks.md', canCreate, preferences = { bookmarks: [] }, savePreferences } = {}) {
  const adapter = memoryAdapter(initial, { canCreate });
  const container = document.createElement('div');
  document.body.append(container);
  const app = mount(container, { core, adapter, initialFile, preferences, savePreferences });
  mounted.push({ app, container });
  const screen = within(container);
  await waitFor(() => expect(screen.queryByText('ファイルを開いています…')).toBeNull());
  const user = userEvent.setup();
  return {
    adapter,
    app,
    container,
    screen,
    user,
    titles: () => screen.queryAllByRole('textbox', { name: '項目の内容' }),
    titleValues: () => screen.queryAllByRole('textbox', { name: '項目の内容' }).map(node => node.value),
    title: value => screen.getAllByRole('textbox', { name: '項目の内容' }).find(node => node.value === value),
    row: value => within(screen.getAllByRole('textbox', { name: '項目の内容' }).find(node => node.value === value).closest('.outline-item')),
    // Saves through the toolbar button and returns the file content on "disk".
    async saved(path = initialFile) {
      await user.click(screen.getByRole('button', { name: '保存' }));
      await waitFor(() => expect(container.querySelector('.save-state').textContent).toBe('保存済み'));
      return adapter.files.get(path);
    },
  };
}

// Lets pending adapter promises (poll, load) settle.
export const flush = () => new Promise(resolve => setTimeout(resolve, 20));
