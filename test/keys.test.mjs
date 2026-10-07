import test from 'node:test';
import assert from 'node:assert/strict';
import { RowKeys } from '../src/ui/keys.ts';

const keysOf = rows => Object.fromEntries(rows.map(row => [row.title, row.key]));

test('keeps row keys when lines are inserted above', () => {
  const keys = new RowKeys();
  const before = keysOf(keys.rows('a.md', '- [ ] a\n- [ ] b\n'));
  const after = keysOf(keys.rows('a.md', '- [ ] new\n- [ ] a\n- [ ] b\n'));
  assert.equal(after.a, before.a);
  assert.equal(after.b, before.b);
  assert.ok(![before.a, before.b].includes(after.new));
});

test('keeps the key of an edited, indented or moved row', () => {
  const keys = new RowKeys();
  const before = keysOf(keys.rows('a.md', '- [ ] a\n- [ ] b\n- [ ] c\n'));
  const edited = keysOf(keys.rows('a.md', '- [ ] a\n- [ ] b2\n- [ ] c\n'));
  assert.equal(edited.b2, before.b);
  const indented = keysOf(keys.rows('a.md', '- [ ] a\n  - [ ] b2\n- [ ] c\n'));
  assert.equal(indented.b2, before.b);
  const moved = keysOf(keys.rows('a.md', '- [ ] c\n- [ ] a\n  - [ ] b2\n'));
  assert.deepEqual(moved, { a: before.a, b2: before.b, c: before.c });
});

test('gives duplicate rows distinct keys and keeps files separate', () => {
  const keys = new RowKeys();
  const rows = keys.rows('a.md', '- [ ] same\n- [ ] same\n');
  assert.notEqual(rows[0].key, rows[1].key);
  const other = keys.rows('b.md', '- [ ] same\n');
  assert.ok(!rows.some(row => row.key === other[0].key));
});
