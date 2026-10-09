import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createMemoryAdapter } from '../src/preview/adapter.ts';
import { messages } from '../src/ui/messages.ts';

const t = messages.en;
const seed = () => createMemoryAdapter({ 'work.md': '- [ ] w\n', 'tasks.md': '- [ ] t\n', 'notes/a.md': '- a\n' }, t);

test('lists the files sorted and reads them', async () => {
  const adapter = seed();
  assert.deepEqual(await adapter.list(), ['notes/a.md', 'tasks.md', 'work.md']);
  assert.equal((await adapter.read('tasks.md')).text, '- [ ] t\n');
  await assert.rejects(adapter.read('missing.md'), { message: t.server.fileMissing });
});

test('saves on the current revision and rejects a stale one as an external change', async () => {
  const adapter = seed();
  const { revision } = await adapter.read('tasks.md');
  const saved = await adapter.save('tasks.md', '- [x] t\n', revision);
  assert.notEqual(saved.revision, revision);
  assert.deepEqual(await adapter.read('tasks.md'), { text: '- [x] t\n', revision: saved.revision });
  await assert.rejects(adapter.save('tasks.md', '- stale\n', revision), { message: t.server.externalChange });
  assert.equal((await adapter.read('tasks.md')).text, '- [x] t\n');
});

test('creates a new file, but not over an existing one or in a missing folder', async () => {
  const adapter = seed();
  const { revision } = await adapter.create('notes/b.md', '- b\n');
  assert.deepEqual(await adapter.read('notes/b.md'), { text: '- b\n', revision });
  assert.deepEqual(await adapter.list(), ['notes/a.md', 'notes/b.md', 'tasks.md', 'work.md']);
  await assert.rejects(adapter.create('tasks.md', '- x\n'), { message: t.server.fileExists });
  await assert.rejects(adapter.create('missing/c.md', '- c\n'), { message: t.server.folderMissing });
  assert.equal((await adapter.read('tasks.md')).text, '- [ ] t\n');
});

test('renames within the folder, keeping the text and the revision', async () => {
  const adapter = seed();
  const before = await adapter.read('tasks.md');
  await adapter.rename('tasks.md', 'todo.md');
  assert.deepEqual(await adapter.read('todo.md'), before);
  assert.deepEqual(await adapter.list(), ['notes/a.md', 'todo.md', 'work.md']);
  await assert.rejects(adapter.read('tasks.md'), { message: t.server.fileMissing });
});

test('does not rename onto an existing file, into another folder, or to an invalid name', async () => {
  const adapter = seed();
  await assert.rejects(adapter.rename('tasks.md', 'work.md'), { message: t.server.fileExists });
  await assert.rejects(adapter.rename('tasks.md', 'notes/tasks.md'), { message: t.server.renameOtherFolder });
  await assert.rejects(adapter.rename('tasks.md', 'a#b.md'), { message: t.server.invalidName });
  assert.deepEqual(await adapter.list(), ['notes/a.md', 'tasks.md', 'work.md']);
  assert.equal((await adapter.read('work.md')).text, '- [ ] w\n');
});
