import test from 'node:test';
import assert from 'node:assert/strict';
import { relativePath, tagOptions } from '../src/ui/slash.ts';

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
