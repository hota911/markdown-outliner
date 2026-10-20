import test from 'node:test';
import assert from 'node:assert/strict';
import { messages } from '../src/ui/messages.ts';
import { commandOptions, relativePath, tagOptions } from '../src/ui/slash.ts';

test('writes an embed path relative to the folder of the embedding file', () => {
  assert.equal(relativePath('tasks.md', 'ref.md'), 'ref.md');
  assert.equal(relativePath('notes/tasks.md', 'notes/ref.md'), 'ref.md');
  assert.equal(relativePath('notes/tasks.md', 'other/ref.md'), '../other/ref.md');
  assert.equal(relativePath('a/b/tasks.md', 'a/ref.md'), '../ref.md');
  assert.equal(relativePath('tasks.md', 'notes/ref.md'), 'notes/ref.md');
});

test('offers tags starting with the query before tags containing it', () => {
  assert.deepEqual(tagOptions('ab', ['xab', 'abc', 'zzz', 'ab-1']).map(option => option.id), ['abc', 'ab-1', 'xab']);
  assert.deepEqual(tagOptions('abc', ['abc']), []);
});

test('offers Collapse for an expanded item with children and Expand for a collapsed one', () => {
  const ids = (query, fold) => commandOptions(query, 'task', false, fold, messages.en).map(option => option.id);
  assert.ok(ids('', 'expanded').includes('collapse'));
  assert.ok(!ids('', 'expanded').includes('expand'));
  assert.ok(ids('', 'collapsed').includes('expand'));
  assert.ok(!ids('', 'collapsed').includes('collapse'));
  assert.ok(!ids('', null).some(id => id === 'collapse' || id === 'expand'));
});

test('matches Collapse and Expand by their English and Japanese words', () => {
  const ids = (query, fold) => commandOptions(query, 'task', false, fold, messages.ja).map(option => option.id);
  for (const query of ['col', 'fold', '折', 'おりたたむ']) assert.deepEqual(ids(query, 'expanded'), ['collapse'], query);
  for (const query of ['exp', 'unfold', 'fold', '展開', 'てんかい']) assert.deepEqual(ids(query, 'collapsed'), ['expand'], query);
});

test('offers the pomodoro estimate commands for tasks, and lowering only an estimate above 0', () => {
  const ids = (kind, estimated) => commandOptions('', kind, false, null, messages.en, estimated).map(option => option.id);
  assert.ok(ids('task', 0).includes('estimate-up'));
  assert.ok(!ids('task', 0).includes('estimate-down'));
  assert.ok(ids('task', 2).includes('estimate-down'));
  assert.ok(!ids('bullet', 2).some(id => id.startsWith('estimate-')));
  const ja = query => commandOptions(query, 'task', false, null, messages.ja, 1).map(option => option.id);
  assert.deepEqual(ja('見積'), ['estimate-up', 'estimate-down']);
  assert.deepEqual(ja('pomodoro'), ['estimate-up', 'estimate-down']);
});

test('offers Delete by its English and Japanese words, except for the zoomed-in item', () => {
  const ids = (query, zoomed) => commandOptions(query, 'task', zoomed, null, messages.ja).map(option => option.id);
  for (const query of ['del', 'erase', '削除', 'さくじょ', 'けす']) assert.deepEqual(ids(query, false), ['delete'], query);
  assert.ok(!ids('', true).includes('delete'));
});
