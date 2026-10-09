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
