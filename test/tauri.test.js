import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createTauriApi } from '../src/tauri/adapter.ts';
import { messages } from '../src/ui/messages.ts';

// A stand-in for the Rust commands: records calls and answers from `replies`. Tauri rejects a
// failed command with the error value itself, which is the error code string.
function fixture(replies) {
  const calls = [];
  const invoke = (command, args) => {
    calls.push([command, args]);
    const reply = replies[command];
    return reply?.rejected ? Promise.reject(reply.rejected) : Promise.resolve(reply);
  };
  return { calls, api: createTauriApi(invoke, messages.en) };
}

test('sends each adapter call as one command and returns the reply', async () => {
  const { calls, api } = fixture({
    list: ['tasks.md'],
    read: { text: '- a\n', revision: 'r1' },
    save: { revision: 'r2' },
    create: { revision: 'r3' },
  });
  assert.deepEqual(await api.adapter.list(), ['tasks.md']);
  assert.deepEqual(await api.adapter.read('tasks.md'), { text: '- a\n', revision: 'r1' });
  assert.deepEqual(await api.adapter.save('tasks.md', '- b\n', 'r1'), { revision: 'r2' });
  assert.deepEqual(await api.adapter.create('new.md', '- c\n'), { revision: 'r3' });
  assert.deepEqual(calls, [
    ['list', {}],
    ['read', { path: 'tasks.md' }],
    ['save', { path: 'tasks.md', text: '- b\n', revision: 'r1' }],
    ['create', { path: 'new.md', text: '- c\n' }],
  ]);
});

test('turns an error code from the app into the same text as the web version', async () => {
  const { api } = fixture({
    save: { rejected: 'externalChange' },
    // Tauri's own failures, such as arguments of the wrong type, are messages rather than codes.
    read: { rejected: 'invalid args `path` for command `read`' },
  });
  await assert.rejects(api.adapter.save('tasks.md', '- b\n', 'r1'), { message: messages.en.server.externalChange });
  await assert.rejects(api.adapter.read('tasks.md'), { message: messages.en.web.requestFailed });
});

test('stores preferences as JSON text', async () => {
  const { calls, api } = fixture({ load_preferences: null, save_preferences: null });
  assert.equal(await api.loadPreferences(), null);
  await api.savePreferences('{"bookmarks":[]}');
  assert.deepEqual(calls.at(-1), ['save_preferences', { value: '{"bookmarks":[]}' }]);
});
