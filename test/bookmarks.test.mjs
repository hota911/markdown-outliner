import test from 'node:test';
import assert from 'node:assert/strict';
import { bookmarkView, sameView, savedView, validBookmark } from '../src/ui/bookmarks.ts';
import { messages } from '../src/ui/messages.ts';

const view = { id: 'a', kind: 'view', file: 'notes/tasks.md', status: 'todo', tags: ['work'], searchText: 'plan' };

test('rejects bookmarks that user-edited storage may hold', () => {
  assert.equal(validBookmark(view), true);
  for (const broken of [null, 'x', { ...view, file: '' }, { ...view, status: 'later' }, { ...view, tags: [1] },
    { ...view, kind: 'other' }, { ...view, zoom: { path: 'a.md', line: 1.5, title: 'x' } }, { ...view, name: 3 }]) {
    assert.equal(validBookmark(broken), false, JSON.stringify(broken));
  }
});

test('a file bookmark restores the file without filters', () => {
  assert.deepEqual(savedView({ ...view, kind: 'file' }), { file: 'notes/tasks.md', status: 'all', tags: [], searchText: '', zoom: null });
});

test('compares the zoomed item by path and title, not by line', () => {
  const zoomed = line => savedView({ ...view, zoom: { path: 'notes/tasks.md', line, title: 'Plan' } });
  assert.equal(sameView(zoomed(1), zoomed(5)), true);
  assert.equal(sameView(zoomed(1), savedView(view)), false);
});

test('labels a bookmark by its name, else by its view', () => {
  const t = messages.en;
  assert.equal(bookmarkView({ ...view, kind: 'file' }, t).label, 'tasks.md');
  assert.equal(bookmarkView({ ...view, name: 'Mine' }, t).label, 'Mine');
  assert.deepEqual(bookmarkView({ id: 1 }, t), { bookmark: { id: 1 }, label: t.bookmarks.unreadableLabel, title: t.bookmarks.unreadableLabel, defaultLabel: '' });
});
