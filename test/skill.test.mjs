// Keeps the agent skill in skills/markdown-outliner/SKILL.md honest: its Markdown examples are
// checked against the real parser and editing operations in src/core.ts.
//
// Fenced blocks are recognized by their info string:
//   ```markdown example          a well-formed file
//   ```markdown before:<name>    the file before an edit
//   ```markdown after:<name>     the file after it, as the outliner itself would write it
//   ```markdown pitfall:<name>   a mistake, with the consequence asserted below
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from '../src/core.ts';

const skill = readFileSync(new URL('../skills/markdown-outliner/SKILL.md', import.meta.url), 'utf8');

const blocks = [...skill.matchAll(/^```markdown (example|(?:before|after|pitfall):[a-z-]+)\n([\s\S]*?)^```$/gm)]
  .map(([, label, text]) => ({ label, text }));
const named = (prefix) => new Map(blocks.filter(block => block.label.startsWith(prefix + ':')).map(block => [block.label.slice(prefix.length + 1), block.text]));
const lineOf = (text, title) => core.parse(text).find(row => row.title === title).line;

// The edits that turn each before:<name> block into its after:<name> block, done with the
// operations the outliner's UI calls.
const edits = {
  'add-sibling': text => {
    const added = core.insert(text, lineOf(text, 'Write the report #work'), { kind: 'task', status: 'todo', tags: [] });
    return core.updateTitle(added.text, added.line, 'Book flights').text;
  },
  'add-child': text => {
    const added = core.insert(text, lineOf(text, 'Write the report #work'), { kind: 'task', status: 'todo', child: true, tags: [] });
    return core.updateTitle(added.text, added.line, 'Draft the summary').text;
  },
  'change-status': text => {
    const started = core.updateStatus(text, lineOf(text, 'Write the report #work'), 'in-progress').text;
    return core.updateStatus(started, lineOf(started, 'Collect numbers'), 'done').text;
  },
  'add-note': text => core.updateNote(text, lineOf(text, 'Collect numbers'), 'Ask finance for the Q3 sheet.').text,
  'move-subtree': text => core.reparent(text, [lineOf(text, 'Pack')], lineOf(text, 'Prepare the trip')).text,
  'embed-file': text => core.embedFile(text, lineOf(text, 'Plan the release'), 'release/checklist.md').text,
};

// Indented lines that are neither an item nor part of an item's note: kept in the file but not
// shown by the outliner.
function orphanedLines(text) {
  const covered = new Set();
  for (const row of core.parse(text)) {
    const noteLines = row.note === '' ? 0 : row.note.split('\n').length;
    for (let line = row.line; line <= row.line + noteLines; line++) covered.add(line);
  }
  return text.split('\n').filter((source, line) => /^\s+\S/.test(source) && !covered.has(line));
}

const pitfalls = {
  'note-after-children': text => assert.deepEqual(orphanedLines(text), ['  This line is lost from the outline.']),
  'odd-indent': text => {
    const rows = core.parse(text);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].note, ' - [ ] Collect numbers');
    assert.throws(() => core.updateNote(text, 0, 'replacement'), { code: 'noteUnsafe' });
  },
  'unknown-status': text => assert.deepEqual(core.parse(text).map(row => [row.kind, row.status, row.title]), [
    ['bullet', null, '[-] Cancelled'], ['bullet', null, '[>] Deferred'],
  ]),
  'empty-task': text => {
    assert.deepEqual(core.parse(text).map(row => [row.kind, row.title]), [['bullet', '[ ]']]);
    // What the outliner writes for a new empty task: the space after `]` is part of it.
    assert.equal(core.insert('', null, { kind: 'task', status: 'todo', tags: [] }).text, '- [ ] \n');
    assert.equal(core.parse('- [ ] ')[0].kind, 'task');
  },
  'not-embed': text => assert.deepEqual(core.parse(text).map(row => row.kind), ['bullet', 'bullet', 'bullet']),
  'list-in-note': text => {
    assert.equal(core.parse(text).length, 1);
    assert.throws(() => core.updateNote(text, 0, 'replacement'), { code: 'noteUnsafe' });
  },
};

test('SKILL.md の例と検査の対応が過不足ない', () => {
  assert.equal(blocks.filter(block => block.label === 'example').length, 1);
  assert.deepEqual([...named('before').keys()].sort(), Object.keys(edits).sort());
  assert.deepEqual([...named('after').keys()].sort(), Object.keys(edits).sort());
  assert.deepEqual([...named('pitfall').keys()].sort(), Object.keys(pitfalls).sort());
});

test('SKILL.md の正しい例は全行が項目かノートで、項目名とノートを書き戻しても変わらない', () => {
  for (const { label, text } of blocks.filter(block => !block.label.startsWith('pitfall:'))) {
    assert.deepEqual(orphanedLines(text), [], label);
    for (const row of core.parse(text)) {
      assert.equal(core.updateTitle(text, row.line, row.title).text, text, `${label}: title of line ${row.line}`);
      if (row.kind !== 'embed') assert.equal(core.updateNote(text, row.line, row.note).text, text, `${label}: note of line ${row.line}`);
    }
  }
});

test('SKILL.md の例のファイルを説明どおりに読む', () => {
  const text = blocks.find(block => block.label === 'example').text;
  assert.deepEqual(core.parse(text).map(row => [row.depth, row.kind, row.status, row.title, row.note]), [
    [0, 'task', 'in-progress', 'Write the weekly report #work', 'Outline first, then write.'],
    [1, 'task', 'todo', 'Collect numbers #work', ''],
    [1, 'task', 'done', 'Pick the main message', ''],
    [0, 'task', 'todo', 'Clean the desk #home', ''],
    [0, 'bullet', null, 'Ideas', ''],
    [1, 'bullet', null, 'Try a standing desk', ''],
    [0, 'embed', null, '![[work.md]]', ''],
  ]);
  assert.deepEqual(core.tagsIn(text), ['work', 'home']);
});

test('SKILL.md の編集例の結果は outliner 自身の操作の結果と一致する', () => {
  const after = named('after');
  for (const [name, before] of named('before')) assert.equal(edits[name](before), after.get(name), name);
});

test('SKILL.md の落とし穴の例は説明どおりの結果になる', () => {
  for (const [name, text] of named('pitfall')) pitfalls[name](text);
});
