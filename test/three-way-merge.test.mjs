import test from 'node:test';
import assert from 'node:assert/strict';
import { merge3 } from '../src/three-way-merge.ts';

const base = '- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n- [ ] e\n';

const clean = (ours, theirs, original = base) => {
  const result = merge3(original, ours, theirs);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.text('theirs'), result.text('ours'));
  return result.text('ours');
};

test('keeps the side that changed when only one side did', () => {
  const edited = '- [ ] a\n- [x] b\n- [ ] c\n- [ ] d\n- [ ] e\n';
  assert.equal(clean(edited, base), edited);
  assert.equal(clean(base, edited), edited);
  assert.equal(clean(base, base), base);
});

test('merges edits, insertions and deletions on different lines', () => {
  assert.equal(
    clean('- [ ] a\n- [ ] b mine\n- [ ] c\n- [ ] d\n- [ ] e\n', '- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d theirs\n- [ ] e\n'),
    '- [ ] a\n- [ ] b mine\n- [ ] c\n- [ ] d theirs\n- [ ] e\n',
  );
  assert.equal(
    clean('- [ ] new first\n- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n- [ ] e\n', '- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n- [ ] e\n- [ ] new last\n'),
    '- [ ] new first\n- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n- [ ] e\n- [ ] new last\n',
  );
  assert.equal(
    clean('- [ ] a\n- [ ] c\n- [ ] d\n- [ ] e\n', '- [ ] a\n- [ ] b\n- [ ] c\n- [ ] e\n'),
    '- [ ] a\n- [ ] c\n- [ ] e\n',
  );
  assert.equal(
    clean('- [ ] a\n- [ ] b\n  - [ ] b child\n- [ ] c\n- [ ] d\n- [ ] e\n', '- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n'),
    '- [ ] a\n- [ ] b\n  - [ ] b child\n- [ ] c\n- [ ] d\n',
  );
});

test('merges edits on neighbouring lines', () => {
  assert.equal(
    clean('- [ ] a\n- [ ] b mine\n- [ ] c\n- [ ] d\n- [ ] e\n', '- [ ] a\n- [ ] b\n- [ ] c theirs\n- [ ] d\n- [ ] e\n'),
    '- [ ] a\n- [ ] b mine\n- [ ] c theirs\n- [ ] d\n- [ ] e\n',
  );
  assert.equal(
    clean('- [ ] a\n- [ ] c\n- [ ] d\n- [ ] e\n', '- [ ] a\n- [ ] b\n- [ ] c theirs\n- [ ] d\n- [ ] e\n'),
    '- [ ] a\n- [ ] c theirs\n- [ ] d\n- [ ] e\n',
  );
  assert.equal(
    clean('- [ ] a\n- [ ] b mine\n- [ ] c\n- [ ] d\n- [ ] e\n', '- [ ] a\n- [ ] b\n- [ ] inserted\n- [ ] c\n- [ ] d\n- [ ] e\n'),
    '- [ ] a\n- [ ] b mine\n- [ ] inserted\n- [ ] c\n- [ ] d\n- [ ] e\n',
  );
});

test('takes an identical change from both sides once', () => {
  const edited = '- [ ] a\n- [x] b\n- [ ] c\n- [ ] d\n';
  assert.equal(clean(edited, edited), edited);
});

test('keeps lines inserted at the same place by both sides, the external ones first', () => {
  assert.equal(
    clean('- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n- [ ] e\n- [ ] mine\n', '- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n- [ ] e\n- [ ] theirs\n'),
    '- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n- [ ] e\n- [ ] theirs\n- [ ] mine\n',
  );
});

test('reports a conflict when both sides change the same line differently', () => {
  const result = merge3(base, '- [ ] a\n- [ ] b mine\n- [ ] c\n- [ ] d theirs too\n- [ ] e\n', '- [ ] a\n- [ ] b theirs\n- [ ] c\n- [ ] d theirs too\n- [ ] e\n');
  assert.deepEqual(result.conflicts, [{ base: ['- [ ] b'], ours: ['- [ ] b mine'], theirs: ['- [ ] b theirs'] }]);
  assert.equal(result.text('ours'), '- [ ] a\n- [ ] b mine\n- [ ] c\n- [ ] d theirs too\n- [ ] e\n');
  assert.equal(result.text('theirs'), '- [ ] a\n- [ ] b theirs\n- [ ] c\n- [ ] d theirs too\n- [ ] e\n');
});

test('reports a conflict when one side edits a line the other deletes', () => {
  const result = merge3(base, '- [ ] a\n- [ ] b\n- [ ] c mine\n- [ ] d\n- [ ] e\n', '- [ ] a\n- [ ] b\n- [ ] d\n- [ ] e\n');
  assert.deepEqual(result.conflicts, [{ base: ['- [ ] c'], ours: ['- [ ] c mine'], theirs: [] }]);
  assert.equal(result.text('theirs'), '- [ ] a\n- [ ] b\n- [ ] d\n- [ ] e\n');
});

test('merges a line inserted between lines the other side edited in place', () => {
  assert.equal(
    clean('- [ ] a\n- [ ] B\n- [ ] C\n- [ ] d\n- [ ] e\n', '- [ ] a\n- [ ] b\n- [ ] inserted\n- [ ] c\n- [ ] d\n- [ ] e\n'),
    '- [ ] a\n- [ ] B\n- [ ] inserted\n- [ ] C\n- [ ] d\n- [ ] e\n',
  );
});

test('reports a conflict when one side inserts inside lines the other replaced', () => {
  const result = merge3(base, '- [ ] a\n- [ ] B and C\n- [ ] d\n- [ ] e\n', '- [ ] a\n- [ ] b\n- [ ] inserted\n- [ ] c\n- [ ] d\n- [ ] e\n');
  assert.deepEqual(result.conflicts, [{
    base: ['- [ ] b', '- [ ] c'],
    ours: ['- [ ] B and C'],
    theirs: ['- [ ] b', '- [ ] inserted', '- [ ] c'],
  }]);
});

test('keeps non-conflicting changes whichever side a conflict takes', () => {
  const result = merge3(base, '- [ ] a mine\n- [ ] b\n- [ ] c mine\n- [ ] d\n- [ ] e\n', '- [ ] a\n- [ ] b\n- [ ] c theirs\n- [ ] d\n- [ ] e theirs\n');
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.text('ours'), '- [ ] a mine\n- [ ] b\n- [ ] c mine\n- [ ] d\n- [ ] e theirs\n');
  assert.equal(result.text('theirs'), '- [ ] a mine\n- [ ] b\n- [ ] c theirs\n- [ ] d\n- [ ] e theirs\n');
});

test('handles the final newline as a line of its own', () => {
  assert.equal(clean('- [ ] a mine\n- [ ] b\n- [ ] c', '- [ ] a\n- [ ] b\n- [ ] c\n', '- [ ] a\n- [ ] b\n- [ ] c'), '- [ ] a mine\n- [ ] b\n- [ ] c\n');
  assert.equal(clean('- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n- [ ] e', '- [ ] a theirs\n- [ ] b\n- [ ] c\n- [ ] d\n- [ ] e\n'), '- [ ] a theirs\n- [ ] b\n- [ ] c\n- [ ] d\n- [ ] e');
  assert.equal(clean('', '- [ ] theirs\n', ''), '- [ ] theirs\n');
});

test('keeps CRLF line endings', () => {
  const crlf = base.replaceAll('\n', '\r\n');
  assert.equal(
    clean(crlf.replace('- [ ] b', '- [ ] b mine'), crlf.replace('- [ ] d', '- [ ] d theirs'), crlf),
    '- [ ] a\r\n- [ ] b mine\r\n- [ ] c\r\n- [ ] d theirs\r\n- [ ] e\r\n',
  );
});

test('merges distant edits in a 2 MB file', () => {
  const lines = Array.from({ length: 60_000 }, (_, index) => `- [ ] task ${index} with some padding text`);
  const large = lines.join('\n') + '\n';
  assert.ok(large.length > 2_000_000);
  const edit = (pairs) => {
    const copy = [...lines];
    for (const [index, value] of pairs) copy[index] = value;
    return copy.join('\n') + '\n';
  };
  const ours = edit([[10, '- [x] mine 10'], [59_000, '- [x] mine 59000']]);
  const theirs = edit([[30_000, '- [x] theirs 30000']]);
  const merged = edit([[10, '- [x] mine 10'], [30_000, '- [x] theirs 30000'], [59_000, '- [x] mine 59000']]);
  assert.equal(clean(ours, theirs, large), merged);
});

test('compares lines in place when a side changed too many lines to align', () => {
  const lines = Array.from({ length: 3000 }, (_, index) => `- [ ] task ${index}`);
  const ours = lines.map((line, index) => index % 2 ? line + ' mine' : line);
  const theirs = lines.map((line, index) => index === 1500 ? line + ' theirs' : line);
  const merged = ours.map((line, index) => index === 1500 ? line + ' theirs' : line);
  assert.equal(clean(ours.join('\n'), theirs.join('\n'), lines.join('\n')), merged.join('\n'));
});

test('treats the middle as one block when a side changed too many lines and the line count', () => {
  const lines = Array.from({ length: 3000 }, (_, index) => `- [ ] task ${index}`);
  const ours = lines.map((line, index) => index % 2 ? line + ' mine' : line).slice(1).join('\n');
  const theirs = lines.map((line, index) => index === 1500 ? line + ' theirs' : line).join('\n');
  const result = merge3(lines.join('\n'), ours, theirs);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.text('ours'), ours);
});

test('splits lines edited in place, so the other side conflicts only on the line it changed', () => {
  const result = merge3(base, '- [ ] A\n- [ ] B\n- [ ] C\n- [ ] d\n- [ ] e\n', '- [ ] a\n- [ ] b theirs\n- [ ] c\n- [ ] d\n- [ ] e theirs\n');
  assert.deepEqual(result.conflicts, [{ base: ['- [ ] b'], ours: ['- [ ] B'], theirs: ['- [ ] b theirs'] }]);
  assert.equal(result.text('theirs'), '- [ ] A\n- [ ] b theirs\n- [ ] C\n- [ ] d\n- [ ] e theirs\n');
});
