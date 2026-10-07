import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createMacApi } from '../src/mac/adapter.ts';
import { messages } from '../src/ui/messages.ts';

// A stand-in for the Swift message handler: records requests and answers from `replies`.
function fixture(replies) {
  const requests = [];
  const post = request => {
    requests.push(request);
    const reply = replies[request.op];
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
  };
  return { requests, api: createMacApi(post, messages.en) };
}

test('sends each adapter call as one message and returns the reply', async () => {
  const { requests, api } = fixture({
    list: ['tasks.md'],
    read: { text: '- a\n', revision: 'r1' },
    save: { revision: 'r2' },
    create: { revision: 'r3' },
  });
  assert.deepEqual(await api.adapter.list(), ['tasks.md']);
  assert.deepEqual(await api.adapter.read('tasks.md'), { text: '- a\n', revision: 'r1' });
  assert.deepEqual(await api.adapter.save('tasks.md', '- b\n', 'r1'), { revision: 'r2' });
  assert.deepEqual(await api.adapter.create('new.md', '- c\n'), { revision: 'r3' });
  assert.deepEqual(requests, [
    { op: 'list' },
    { op: 'read', path: 'tasks.md' },
    { op: 'save', path: 'tasks.md', text: '- b\n', revision: 'r1' },
    { op: 'create', path: 'new.md', text: '- c\n' },
  ]);
});

test('turns an error code from the app into the same text as the web version', async () => {
  // WKWebView rejects with an Error whose message is the replyHandler's error string.
  const { api } = fixture({ save: new Error('externalChange'), read: new Error('unknown') });
  await assert.rejects(api.adapter.save('tasks.md', '- b\n', 'r1'), { message: messages.en.server.externalChange });
  await assert.rejects(api.adapter.read('tasks.md'), { message: messages.en.web.requestFailed });
});

test('stores preferences as JSON text', async () => {
  const { requests, api } = fixture({ loadPreferences: null, savePreferences: null });
  assert.equal(await api.loadPreferences(), null);
  await api.savePreferences('{"bookmarks":[]}');
  assert.deepEqual(requests.at(-1), { op: 'savePreferences', value: '{"bookmarks":[]}' });
});
