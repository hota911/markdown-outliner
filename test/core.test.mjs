import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/core.ts';

test('非表示の兄弟を含む全順序で子とノートごと移動する', () => {
  const text = '- [ ] A #visible\n  A note\n  - [ ] child\n    child note\n- [x] hidden\n  hidden note\n- [ ] C #visible\n';
  assert.deepEqual(core.move(text, 6, 'up'), {
    text: '- [ ] A #visible\n  A note\n  - [ ] child\n    child note\n- [ ] C #visible\n- [x] hidden\n  hidden note\n', line: 4
  });
  assert.deepEqual(core.move(text, 0, 'down'), {
    text: '- [x] hidden\n  hidden note\n- [ ] A #visible\n  A note\n  - [ ] child\n    child note\n- [ ] C #visible\n', line: 2
  });
});

test('Frontmatter、見出し、非リスト本文と改行を保持して項目名を編集する', () => {
  const text = '---\r\ntitle: example\r\n---\r\n# Heading\r\nBody\r\n- [ ] old\r\n  note\r\n\r\nfooter\r\n';
  assert.equal(core.updateTitle(text, 5, 'new').text, '---\r\ntitle: example\r\n---\r\n# Heading\r\nBody\r\n- [ ] new\r\n  note\r\n\r\nfooter\r\n');
});

test('現在の状態とタグ条件を持つ第一子をノートの後に追加する', () => {
  const inserted = core.insert('- [ ] parent\n  note\n  - [x] old child\n', 0, { child: true, status: 'in-progress', tags: ['work', '#urgent'] });
  assert.deepEqual(inserted, { text: '- [ ] parent\n  note\n  - [/] #work #urgent\n  - [x] old child\n', line: 2 });
  assert.equal(core.parse(inserted.text)[0].note, 'note');
});

test('箇条書きの子をノートの後に追加し既存の子とCRLFを保つ', () => {
  const text = '---\r\ntitle: example\r\n---\r\n# Tasks\r\n- [ ] parent\r\n  parent note\r\n  - [x] old child\r\n    child note\r\n';
  const inserted = core.insert(text, 4, { kind: 'bullet', child: true, status: 'done', tags: ['work', '#urgent'] });
  assert.deepEqual(inserted, {
    text: '---\r\ntitle: example\r\n---\r\n# Tasks\r\n- [ ] parent\r\n  parent note\r\n  - #work #urgent\r\n  - [x] old child\r\n    child note\r\n', line: 6
  });
  assert.deepEqual(core.parse(inserted.text)[2], {
    line: 6, end: 7, depth: 1, parentLine: 4, kind: 'bullet', title: '#work #urgent', status: null, note: '', embed: null, level: null
  });
});

test('状態を指定せず箇条書きを兄弟の子とノートの後へ追加する', () => {
  assert.deepEqual(core.insert('- parent\n  parent note\n  - child\n    child note\n- next\n', 0, { kind: 'bullet', child: false, tags: ['new'] }), {
    text: '- parent\n  parent note\n  - child\n    child note\n- #new\n- next\n', line: 4
  });
  assert.deepEqual(core.insert('# Notes\n', null, { kind: 'bullet', child: false, tags: [] }), {
    text: '# Notes\n- \n', line: 1
  });
});

test('項目の前に同じ階層の兄弟を追加し、項目のノートと子を保つ', () => {
  const text = '- [ ] first\n- [x] parent\n  note\n  - [ ] child\n';
  assert.deepEqual(core.insert(text, 1, { kind: 'task', before: true, status: 'todo', tags: ['work'] }), {
    text: '- [ ] first\n- [ ] #work\n- [x] parent\n  note\n  - [ ] child\n', line: 1
  });
  assert.deepEqual(core.insert('- parent\n\t- child\n', 1, { kind: 'bullet', before: true, tags: [] }), {
    text: '- parent\n\t- \n\t- child\n', line: 1
  });
  assert.throws(() => core.insert(text, 1, { kind: 'task', before: true, child: true, status: 'todo', tags: [] }), { code: 'invalidInsert' });
  assert.throws(() => core.insert(text, null, { kind: 'task', before: true, status: 'todo', tags: [] }), { code: 'invalidInsert' });
});

test('追加する種類とタスクの状態とタグを検証する', () => {
  assert.throws(() => core.insert('- parent\n', 0, { kind: 'ordered', child: false, status: 'todo', tags: [] }), { code: 'invalidInsert' });
  assert.throws(() => core.insert('- parent\n', 0, { kind: 'task', child: false, status: 'unknown', tags: [] }), { code: 'invalidInsert' });
  assert.throws(() => core.insert('- parent\n', 0, { kind: 'bullet', child: false, tags: ['two words'] }), { code: 'invalidTag' });
  assert.deepEqual(core.insert('- parent\n', 0, { kind: 'task', child: false, status: 'in-progress', tags: ['work'] }), {
    text: '- parent\n- [/] #work\n', line: 1
  });
});

test('複数行ノートの変更で子項目を保持する', () => {
  const text = '- [ ] parent\n  old note\n  - [ ] child\n    child note\n';
  const changed = core.updateNote(text, 0, 'line one\n\nline three');
  assert.equal(changed.text, '- [ ] parent\n  line one\n  \n  line three\n  - [ ] child\n    child note\n');
  assert.equal(core.parse(changed.text)[0].note, 'line one\n\nline three');
  assert.equal(core.parse(changed.text)[1].note, 'child note');
});

test('ファイル全体の埋め込みだけを判別する', () => {
  assert.deepEqual(core.parse('- ![[tasks.md]]\n')[0], { line: 0, end: 1, depth: 0, parentLine: null, kind: 'embed', title: '![[tasks.md]]', status: null, note: '', embed: 'tasks.md', level: null });
  assert.equal(core.parse('- ![[tasks.md#section]]\n')[0].kind, 'bullet');
});

test('存在しない行や項目名の改行は失敗し、無効な構造操作は変更しない', () => {
  assert.throws(() => core.updateTitle('# heading\n', 0, 'x'), { code: 'headingReadOnly' });
  assert.throws(() => core.updateTitle('- [ ] item\n', 0, 'x\ny'));
  assert.deepEqual(core.outdent('- [ ] root\n', 0), { text: '- [ ] root\n', line: 0 });
  assert.deepEqual(core.indent('- [ ] root\n', 0), { text: '- [ ] root\n', line: 0 });
});

test('未対応記法とコード内のリストを原文保持し危険なノート編集を拒否する', () => {
  const text = '- [ ] task\n  1. unsupported numbered\n```md\n- [ ] code sample\n```\n1. numbered root\n- [ ] second\n';
  assert.equal(core.parse(text).length, 2);
  assert.equal(core.updateStatus(text, 0, 'done').text, '- [x] task\n  1. unsupported numbered\n```md\n- [ ] code sample\n```\n1. numbered root\n- [ ] second\n');
  assert.throws(() => core.updateNote(text, 0, 'replacement'));
  assert.deepEqual(core.move(text, 0, 'down'), { text, line: 0 });
});

test('インデントとアウトデントが子とノートを保持する', () => {
  const text = '- [ ] parent\n- [ ] moving\n  note\n  - [ ] child\n';
  const indented = core.indent(text, 1);
  assert.equal(indented.text, '- [ ] parent\n  - [ ] moving\n    note\n    - [ ] child\n');
  assert.equal(core.outdent(indented.text, 1).text, text);
  assert.equal(core.outdent('- [ ] parent\n  - [ ] first\n  - [ ] second\n', 1).text, '- [ ] parent\n  - [ ] second\n- [ ] first\n');
});

test('タブによる階層と末尾への追加を扱う', () => {
  assert.equal(core.parse('- root\n\t- child\n')[1].parentLine, 0);
  assert.deepEqual(core.insert('# Tasks\n', null, { child: false, status: 'todo', tags: [] }), { text: '# Tasks\n- [ ] \n', line: 1 });
});

test('空行を挟む兄弟の移動とインデントで原文の空行を保持する', () => {
  assert.deepEqual(core.move('- A\n\n- B\n', 0, 'down'), { text: '- B\n\n- A\n', line: 2 });
  assert.equal(core.indent('- A\n\n- B\n', 2).text, '- A\n\n  - B\n');
});

test('前との結合は片方のノートと子を保持する', () => {
  const text = '# Tasks\r\n- [/] first\r\n- [ ] second\r\n  second note\r\n  - [ ] child\r\n- [ ] last\r\n';
  assert.deepEqual(core.merge(text, 2, 'previous'), { text: '# Tasks\r\n- [/] firstsecond\r\n  second note\r\n  - [ ] child\r\n- [ ] last\r\n', line: 1, column: 5 });
});

test('親と次の子を結合しても残った子の階層を保つ', () => {
  assert.deepEqual(core.merge('- [ ] parent\n  note\n  - [ ] first\n  - [ ] second\n', 0, 'next'), {
    text: '- [ ] parentfirst\n  note\n  - [ ] second\n', line: 0, column: 6
  });
});

test('階層の異なる前の項目との結合でノートと子の所属を保つ', () => {
  assert.deepEqual(core.merge('- [ ] parent\n  - [ ] child\n- [ ] following\n  new note\n  - [ ] nested\n', 2, 'previous'), {
    text: '- [ ] parent\n  - [ ] childfollowing\n    new note\n    - [ ] nested\n', line: 1, column: 5
  });
});

test('両方にノートまたは子がある結合は拒否する', () => {
  assert.throws(() => core.merge('- [ ] first\n  first note\n- [ ] second\n  second note\n', 0, 'next'), { code: 'mergeBothHaveContent' });
  assert.throws(() => core.merge('- [ ] parent\n  - [ ] child\n    child note\n', 1, 'previous'), { code: 'mergeBothHaveContent' });
  assert.throws(() => core.merge('- [ ] parent\n  - [ ] child\n    - [ ] grandchild\n', 0, 'next'), { code: 'mergeBothHaveContent' });
  assert.deepEqual(core.merge('- [ ] first\n- [ ] second\n', 0, 'next'), { text: '- [ ] firstsecond\n', line: 0, column: 5 });
});

test('先頭・末尾は変更せず、埋め込みと本文の境界をまたぐ結合は拒否する', () => {
  assert.deepEqual(core.merge('- [ ] only\n', 0, 'previous'), { text: '- [ ] only\n', line: 0, column: 0 });
  assert.deepEqual(core.merge('- [ ] only\n', 0, 'next'), { text: '- [ ] only\n', line: 0, column: 4 });
  assert.throws(() => core.merge('- [ ] first\n- ![[work.md]]\n', 0, 'next'), { code: 'mergeAcrossEmbed' });
  assert.throws(() => core.merge('- [ ] first\n# Heading\n- [ ] second\n', 0, 'next'), { code: 'mergeAcrossText' });
});

test('離れた選択を原順で子とノートごと対象の後へ移す', () => {
  const text = '# Tasks\r\n- [ ] A\r\n  A note\r\n  - [ ] child\r\n- [x] B\r\n- [/] C\r\n  C note\r\n- [ ] D\r\n';
  assert.deepEqual(core.reorder(text, [5, 1], 7, 'after'), {
    text: '# Tasks\r\n- [x] B\r\n- [ ] D\r\n- [ ] A\r\n  A note\r\n  - [ ] child\r\n- [/] C\r\n  C note\r\n', line: 3, lines: [3, 6]
  });
});

test('複数の兄弟を対象の前へ移してノートの所属を保つ', () => {
  const text = '- [ ] parent\n  parent note\n  - [ ] A\n  - [ ] B\n    B note\n  - [ ] C\n  - [ ] D\n- [ ] next\n';
  assert.deepEqual(core.reorder(text, [6, 3], 2), {
    text: '- [ ] parent\n  parent note\n  - [ ] B\n    B note\n  - [ ] D\n  - [ ] A\n  - [ ] C\n- [ ] next\n', line: 2, lines: [2, 4]
  });
});

test('対象の前後を含む選択を束ね、空行を削除しない', () => {
  assert.deepEqual(core.reorder('- A\n\n- B\n\n- C\n\n- D\n', [0, 6], 2, 'after'), {
    text: '\n- B\n- A\n- D\n\n- C\n\n', line: 2, lines: [2, 3]
  });
});

test('親の選択に含まれる子を除外し重複選択を一度だけ移す', () => {
  assert.deepEqual(core.reorder('- A\n  - child\n    - grandchild\n- B\n', [2, 1, 0, 0], 3, 'after'), {
    text: '- B\n- A\n  - child\n    - grandchild\n', line: 1, lines: [1]
  });
});

test('対象が選択または選択の子なら変更しない', () => {
  const text = '- A\n  - child\n- B\n';
  assert.deepEqual(core.reorder(text, [0, 1], 0, 'after'), { text, line: 0, lines: [0] });
  assert.deepEqual(core.reorder(text, [0], 1), { text, line: 0, lines: [0] });
});

test('親の異なる選択と対象、存在しない行、不正な条件を拒否する', () => {
  const text = '- A\n  - child\n- B\n  - other\n';
  assert.throws(() => core.reorder(text, [1, 3], 2), { code: 'reorderSiblingsOnly' });
  assert.throws(() => core.reorder(text, [1], 3), { code: 'reorderSiblingsOnly' });
  assert.throws(() => core.reorder(text, [99], 0), { code: 'noEditableItem' });
  assert.throws(() => core.reorder(text, [0], 99), { code: 'noEditableItem' });
  assert.throws(() => core.reorder(text, [], 0), { code: 'invalidReorder' });
  assert.throws(() => core.reorder(text, [0], 2, 'middle'), { code: 'invalidReorder' });
});

test('本文をまたぐ並び替えと、見出しをまたぐ並び替えを拒否する', () => {
  assert.throws(() => core.reorder('- A\nText\n- B\n', [0], 2, 'after'), { code: 'reorderAcrossText' });
  assert.throws(() => core.reorder('- A\n# Heading\n- B\n', [0], 2, 'after'), { code: 'reorderSiblingsOnly' });
  assert.throws(() => core.reorder('- A\n# Heading\n- B\n', [1], 0), { code: 'headingReadOnly' });
});

test('埋め込みの行も項目と同じく並び替える', () => {
  assert.deepEqual(core.reorder('- A\n- ![[work.md]]\n- B\n', [0], 2, 'after'), {
    text: '- ![[work.md]]\n- B\n- A\n', line: 2, lines: [2]
  });
  assert.deepEqual(core.reorder('- A\n- ![[work.md]]\n', [1], 0), { text: '- ![[work.md]]\n- A\n', line: 0, lines: [0] });
  assert.deepEqual(core.reorder('- A\n  - ![[work.md]]\n- B\n', [0], 2, 'after'), {
    text: '- B\n- A\n  - ![[work.md]]\n', line: 1, lines: [1]
  });
});

test('埋め込みの行を兄弟の間で上下に移す', () => {
  assert.deepEqual(core.move('- A\n- ![[work.md]]\n- B\n', 1, 'up'), { text: '- ![[work.md]]\n- A\n- B\n', line: 0 });
  assert.deepEqual(core.move('- A\n- ![[work.md]]\n- B\n', 1, 'down'), { text: '- A\n- B\n- ![[work.md]]\n', line: 2 });
});

test('複数選択を原順で対象の最後の子へ移しノートと子を保持する', () => {
  const text = '# Tasks\r\n- [ ] A\r\n  A note\r\n  - [/] A child\r\n    child note\r\n- [x] B\r\n- [ ] C\r\n  C note\r\n- [ ] parent\r\n  parent note\r\n  - [x] old child\r\n    - [ ] old grandchild\r\n- [ ] last\r\n';
  assert.deepEqual(core.reparent(text, [6, 1, 1], 8), {
    text: '# Tasks\r\n- [x] B\r\n- [ ] parent\r\n  parent note\r\n  - [x] old child\r\n    - [ ] old grandchild\r\n  - [ ] A\r\n    A note\r\n    - [/] A child\r\n      child note\r\n  - [ ] C\r\n    C note\r\n- [ ] last\r\n',
    line: 6, lines: [6, 10]
  });
});

test('異なる親の子へ移して両方の親のノートを保つ', () => {
  const text = '- [ ] destination\n  destination note\n  - [ ] nested target\n    target note\n    - [ ] old child\n- [ ] source parent\n  source note\n  - [ ] moving\n    moving note\n    - [ ] child\n  - [ ] remaining\n';
  assert.deepEqual(core.reparent(text, [7], 2), {
    text: '- [ ] destination\n  destination note\n  - [ ] nested target\n    target note\n    - [ ] old child\n    - [ ] moving\n      moving note\n      - [ ] child\n- [ ] source parent\n  source note\n  - [ ] remaining\n',
    line: 5, lines: [5]
  });
});

test('深い子を前の浅い項目の最後の子へ移す', () => {
  const text = '- [ ] target\n  target note\n- [ ] parent\n  - [ ] nested\n    nested note\n    - [ ] moving\n      moving note\n      - [ ] child\n';
  assert.deepEqual(core.reparent(text, [5], 0), {
    text: '- [ ] target\n  target note\n  - [ ] moving\n    moving note\n    - [ ] child\n- [ ] parent\n  - [ ] nested\n    nested note\n',
    line: 2, lines: [2]
  });
});

test('対象の前後にある兄弟を最後の子へ束ね空行を保持する', () => {
  const text = '- A\n\n- target\n\n- B\n';
  assert.deepEqual(core.reparent(text, [4, 0], 2), {
    text: '\n- target\n  - A\n  - B\n\n', line: 2, lines: [2, 3]
  });
});

test('同じ親へ移すと選択した子だけが最後に並ぶ', () => {
  const text = '- parent\n  parent note\n  - A\n    A note\n  - B\n  - C\n';
  assert.deepEqual(core.reparent(text, [2], 0), {
    text: '- parent\n  parent note\n  - B\n  - C\n  - A\n    A note\n', line: 4, lines: [4]
  });
});

test('自分自身や子孫を対象にした循環と異なる親の選択を拒否する', () => {
  const text = '- A\n  - child\n    - grandchild\n- B\n  - other\n';
  assert.throws(() => core.reparent(text, [0], 0), { code: 'reparentIntoSelf' });
  assert.throws(() => core.reparent(text, [0], 2), { code: 'reparentIntoSelf' });
  assert.throws(() => core.reparent(text, [0, 3], 3), { code: 'reparentIntoSelf' });
  assert.throws(() => core.reparent(text, [1, 4], 3), { code: 'reparentSiblingsOnly' });
  assert.throws(() => core.reparent(text, [0, 1], 3), { code: 'reparentSiblingsOnly' });
});

test('本文の境界をまたぐ子への移動を拒否する', () => {
  assert.throws(() => core.reparent('- A\nText\n- target\n', [0], 2), { code: 'reparentAcrossText' });
  assert.throws(() => core.reparent('- target\n```md\n- code\n```\n- A\n', [4], 0), { code: 'reparentAcrossText' });
});

test('埋め込みの行を項目の子へ移し、項目を埋め込みの前後へ移す', () => {
  assert.deepEqual(core.reparent('- ![[work.md]]\n- target\n', [0], 1), { text: '- target\n  - ![[work.md]]\n', line: 1, lines: [1] });
  assert.deepEqual(core.reparent('- A\n- ![[work.md]]\n- target\n', [0], 2), { text: '- ![[work.md]]\n- target\n  - A\n', line: 2, lines: [2] });
  assert.deepEqual(core.reparent('- A\n  - ![[work.md]]\n- target\n', [0], 2), { text: '- target\n  - A\n    - ![[work.md]]\n', line: 1, lines: [1] });
  assert.deepEqual(core.reparent('- A\n- target\n  - ![[work.md]]\n', [0], 1), { text: '- target\n  - ![[work.md]]\n  - A\n', line: 2, lines: [2] });
  assert.deepEqual(core.reparent('- target\n  - ![[work.md]]\n- moving\n', [2], 0, 1), { text: '- target\n  - moving\n  - ![[work.md]]\n', line: 1, lines: [1] });
});

test('埋め込みの行やその子の下へは移さない', () => {
  assert.throws(() => core.reparent('- A\n- ![[work.md]]\n', [0], 1), { code: 'reparentIntoEmbed' });
  assert.throws(() => core.reparent('- ![[work.md]]\n  - A\n  - target\n', [1], 2), { code: 'reparentIntoEmbed' });
});

test('子への移動で存在しない行や不正な選択を拒否する', () => {
  const text = '- A\n- target\n';
  assert.throws(() => core.reparent(text, [], 1), { code: 'invalidReparent' });
  assert.throws(() => core.reparent(text, null, 1), { code: 'invalidReparent' });
  assert.throws(() => core.reparent(text, [99], 1), { code: 'noEditableItem' });
  assert.throws(() => core.reparent(text, [0, '0'], 1), { code: 'noEditableItem' });
  assert.throws(() => core.reparent(text, [0], 99), { code: 'noEditableItem' });
});

test('既存の子の間へ選択を原順で挿入し子とノートを保つ', () => {
  const text = '- A\n  A note\n  - A child\n- B\n- C\n- target\n  target note\n  - first child\n    - first grandchild\n  - second child\n    second note\n- last\n';
  assert.deepEqual(core.reparent(text, [4, 0], 5, 9), {
    text: '- B\n- target\n  target note\n  - first child\n    - first grandchild\n  - A\n    A note\n    - A child\n  - C\n  - second child\n    second note\n- last\n',
    line: 5, lines: [5, 8]
  });
});

test('後ろの項目を最初の子の前へ挿入する', () => {
  const text = '- target\n  target note\n  - old child\n- source parent\n  source note\n  - moving\n    moving note\n';
  assert.deepEqual(core.reparent(text, [5], 0, 2), {
    text: '- target\n  target note\n  - moving\n    moving note\n  - old child\n- source parent\n  source note\n',
    line: 2, lines: [2]
  });
});

test('同じ親の前後にある選択を指定した子の前へ束ねる', () => {
  const text = '- parent\n  parent note\n  - A\n    A note\n  - B\n  - C\n    - C child\n';
  assert.deepEqual(core.reparent(text, [5, 2], 0, 4), {
    text: '- parent\n  parent note\n  - A\n    A note\n  - C\n    - C child\n  - B\n',
    line: 2, lines: [2, 4]
  });
});

test('挿入位置が直接の子でない場合や選択した子の場合を拒否する', () => {
  const text = '- target\n  target note\n  - first\n    - grandchild\n  - second\n- moving\n';
  assert.throws(() => core.reparent(text, [5], 0, 0), { code: 'invalidInsertPosition' });
  assert.throws(() => core.reparent(text, [5], 0, 1), { code: 'invalidInsertPosition' });
  assert.throws(() => core.reparent(text, [5], 0, 3), { code: 'invalidInsertPosition' });
  assert.throws(() => core.reparent(text, [5], 0, 5), { code: 'invalidInsertPosition' });
  assert.throws(() => core.reparent(text, [5], 0, 99), { code: 'invalidInsertPosition' });
  assert.throws(() => core.reparent(text, [5], 0, '2'), { code: 'invalidInsertPosition' });
  assert.throws(() => core.reparent(text, [2], 0, 2), { code: 'insertPositionInSelection' });
  assert.throws(() => core.reparent(text, [2, 4], 0, 4), { code: 'insertPositionInSelection' });
});

test('子の間への移動も本文の境界をまたげない', () => {
  assert.throws(() => core.reparent('- target\n  - child\nText\n- moving\n', [3], 0, 1), { code: 'reparentAcrossText' });
});

test('Bの子CをルートのBの前へ移してA、C、Bの順にする', () => {
  const text = '- [ ] A\n- [ ] B\n  B note\n  - [/] C\n    C note\n    - [x] grandchild\n  - [ ] remaining\n';
  assert.deepEqual(core.reparent(text, [3], null, 1), {
    text: '- [ ] A\n- [/] C\n  C note\n  - [x] grandchild\n- [ ] B\n  B note\n  - [ ] remaining\n',
    line: 1, lines: [1]
  });
});

test('複数の子を原順で見出しの末尾へ移しCRLFを保つ', () => {
  const text = '# Tasks\r\n- parent\r\n  parent note\r\n  - A\r\n    A note\r\n  - B\r\n  - C\r\n    - C child\r\n- last\r\n';
  assert.deepEqual(core.reparent(text, [6, 3], 0), {
    text: '# Tasks\r\n- parent\r\n  parent note\r\n  - B\r\n- last\r\n- A\r\n  A note\r\n- C\r\n  - C child\r\n',
    line: 5, lines: [5, 7]
  });
});

test('末尾改行のない子をルート末尾へ移せる', () => {
  assert.deepEqual(core.reparent('- parent\n  - child\n- last', [1], null), {
    text: '- parent\n- last\n- child', line: 2, lines: [2]
  });
});

test('ルート末尾へ移しても途中と末尾にあった空行を削除しない', () => {
  assert.deepEqual(core.reparent('- parent\n  - child\n\n- last\n\n', [1], null), {
    text: '- parent\n\n- last\n\n- child\n', line: 4, lines: [4]
  });
});

test('ルートへの移動も本文の境界を拒否する', () => {
  assert.throws(() => core.reparent('- parent\n  - child\nFooter\n', [1], null), { code: 'reparentAcrossText' });
  assert.throws(() => core.reparent('- before\nText\n- parent\n  - child\n', [3], null, 0), { code: 'reparentAcrossText' });
});

test('ルートへの移動で埋め込みの行をまたぐ', () => {
  assert.deepEqual(core.reparent('- parent\n  - child\n- ![[work.md]]\n', [1], null), { text: '- parent\n- ![[work.md]]\n- child\n', line: 2, lines: [2] });
  assert.deepEqual(core.reparent('- parent\n  - child\n- ![[work.md]]\n', [1], null, 2), { text: '- parent\n- child\n- ![[work.md]]\n', line: 1, lines: [1] });
  assert.deepEqual(core.reparent('- parent\n  - ![[work.md]]\n- after\n', [1], null, 2), { text: '- parent\n- ![[work.md]]\n- after\n', line: 1, lines: [1] });
});

test('ルートの挿入位置に子や選択中の項目を指定できない', () => {
  const text = '- A\n  - child\n- B\n';
  assert.throws(() => core.reparent(text, [2], null, 1), { code: 'invalidInsertPosition' });
  assert.throws(() => core.reparent(text, [0], null, 0), { code: 'insertPositionInSelection' });
  assert.throws(() => core.reparent(text, [0], null, 99), { code: 'invalidInsertPosition' });
});

test('項目を子とノートごと字下げを戻して切り出し、元の字下げで埋め込みに置き換える', () => {
  const text = '# H\r\n- [ ] parent\r\n  - [/] Task #work\r\n    note line\r\n\r\n    more note\r\n    - [ ] child\r\n      child note\r\n  - [ ] sibling\r\n';
  assert.deepEqual(core.extractToFile(text, 2, 'Task.md'), {
    text: '# H\r\n- [ ] parent\r\n  - ![[Task.md]]\r\n  - [ ] sibling\r\n', line: 2,
    extracted: '- [/] Task #work\r\n  note line\r\n\r\n  more note\r\n  - [ ] child\r\n    child note\r\n'
  });
});

test('タブ字下げと箇条書きの項目をタブを保ったまま切り出す', () => {
  assert.deepEqual(core.extractToFile('- parent\n\t- memo\n\t\t- child\n', 1, 'memo.md'), {
    text: '- parent\n\t- ![[memo.md]]\n', line: 1, extracted: '- memo\n\t- child\n'
  });
});

test('埋め込み行と不正なファイル名は切り出さない', () => {
  assert.throws(() => core.extractToFile('- ![[work.md]]\n', 0, 'work 2.md'), { code: 'extractEmbed' });
  assert.throws(() => core.extractToFile('- [ ] task\n', 0, 'a/b.md'), { code: 'invalidFileName' });
  assert.throws(() => core.extractToFile('- [ ] task\n', 0, 'task'), { code: 'invalidFileName' });
});

test('名前の変更ではフォルダーを残してファイル名だけを差し替える', () => {
  assert.equal(core.renamedEmbed('sub/work.md', 'done jobs'), 'sub/done jobs.md');
  assert.equal(core.renamedEmbed('../work.md', '作業'), '../作業.md');
  for (const name of ['', ' x', '.hidden', 'a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b', 'a#b', 'a^b', 'a[b', 'a]b', 'a\nb']) {
    assert.equal(core.usableBaseName(name), false, JSON.stringify(name));
    assert.throws(() => core.renamedEmbed('work.md', name), { code: 'invalidFileName' });
  }
  assert.equal(core.usableBaseName('done jobs 2'), true);
});

test('埋め込み行の参照先だけを書き換え、ホストが書き換えた拡張子なしのリンクも置き換える', () => {
  assert.deepEqual(core.retargetEmbed('- [ ] a\n  - ![[sub/work.md]]\n', 1, 'sub/jobs.md'), { text: '- [ ] a\n  - ![[sub/jobs.md]]\n', line: 1 });
  assert.equal(core.retargetEmbed('- ![[jobs]]\n', 0, 'jobs.md').text, '- ![[jobs.md]]\n');
  assert.throws(() => core.retargetEmbed('- [ ] task\n', 0, 'jobs.md'), { code: 'notEmbed' });
  assert.throws(() => core.retargetEmbed('- ![[work.md]]\n', 0, 'jobs'), { code: 'invalidFileName' });
});

test('タスクの状態を外して箇条書きにし、記号と字下げとノートを保つ', () => {
  assert.deepEqual(core.toBullet('- parent\r\n\t* [/] Task #work\r\n\t  note\r\n', 1), { text: '- parent\r\n\t* Task #work\r\n\t  note\r\n', line: 1 });
  assert.deepEqual(core.toBullet('- bullet\n', 0), { text: '- bullet\n', line: 0 });
  assert.deepEqual(core.updateStatus('- bullet\n', 0, 'done'), { text: '- [x] bullet\n', line: 0 });
  assert.throws(() => core.toBullet('- ![[work.md]]\n', 0), { code: 'embedHasNoStatus' });
});

test('空の項目を埋め込みに置き換え、それ以外は次の兄弟として埋め込みを追加する', () => {
  assert.deepEqual(core.embedFile('- parent\n\t- [ ] \n- next\n', 1, 'work.md'), { text: '- parent\n\t- ![[work.md]]\n- next\n', line: 1 });
  assert.deepEqual(core.embedFile('- [ ] task\n  note\n  - child\n- next\n', 0, '../notes/a b.md'), {
    text: '- [ ] task\n  note\n  - child\n- ![[../notes/a b.md]]\n- next\n', line: 3,
  });
  assert.deepEqual(core.embedFile('- [ ] \n  - child\n', 0, 'work.md'), { text: '- [ ] \n  - child\n- ![[work.md]]\n', line: 2 });
  assert.deepEqual(core.embedFile('- [ ] \r\n  note\r\n', 0, 'work.md'), { text: '- [ ] \r\n  note\r\n- ![[work.md]]\r\n', line: 2 });
});

test('埋め込めないファイル名と存在しない行を拒否する', () => {
  assert.throws(() => core.embedFile('- [ ] \n', 0, 'work'), { code: 'invalidFileName' });
  assert.throws(() => core.embedFile('- [ ] \n', 0, 'a]]b.md'), { code: 'invalidFileName' });
  assert.throws(() => core.embedFile('- [ ] \n', 0, 'a#b.md'), { code: 'invalidFileName' });
  assert.throws(() => core.embedFile('# H\n', 0, 'work.md'), { code: 'headingReadOnly' });
  assert.throws(() => core.embedFile('Text\n', 0, 'work.md'), { code: 'noEditableItem' });
});

test('タイトルからタグと使えない文字を除いてファイル名を作り、重複には番号を付ける', () => {
  assert.equal(core.fileName('[資料] 作成: A/B #work  #urgent', [], 'タスク'), '資料 作成 AB.md');
  assert.equal(core.fileName('a\\b*c?d"e<f>g|h^i', [], 'タスク'), 'abcdefghi.md');
  assert.equal(core.fileName('#work', [], 'タスク'), 'タスク.md');
  assert.equal(core.fileName('#work', ['Task.md'], 'Task'), 'Task 2.md');
  assert.equal(core.fileName('...hidden', [], 'タスク'), 'hidden.md');
  assert.equal(core.fileName('Plan', ['plan.md', 'Plan 2.md', 'other.md'], 'タスク'), 'Plan 3.md');
});

test('Obsidian の規則でタグを # なしで出現順に重複なく取り出す', () => {
  const text = '# Heading\n- [ ] #work Plan #仕事/進行中, #my_tag-2\n  note #work #1984 #y1984\n- a#b https://example.com/#x ![[f.md#h]] ＃全角\n#start';
  assert.deepEqual(core.tagsIn(text), ['work', '仕事/進行中', 'my_tag-2', 'y1984', 'start']);
});

const sections = '- pre\n# A ##\n- a\n  note\n## A1\n- a1\n# B\n```\n# code\n```\n- b\nSetext\n===\n';

test('見出しを行にし、深い見出しと見出しの下の最上位の項目を子にする', () => {
  assert.deepEqual(core.parse(sections).map(row => [row.line, row.kind, row.level, row.title, row.parentLine, row.end]), [
    [0, 'bullet', null, 'pre', null, 1],
    [1, 'heading', 1, 'A', null, 6],
    [2, 'bullet', null, 'a', 1, 4],
    [4, 'heading', 2, 'A1', 1, 6],
    [5, 'bullet', null, 'a1', 4, 6],
    [6, 'heading', 1, 'B', null, 14],
    [10, 'bullet', null, 'b', 6, 11],
  ]);
  assert.deepEqual(core.parse('#tag\n#\n####### x\n').map(row => [row.kind, row.title]), [['heading', '']]);
});

test('見出しは読み取り専用で、項目との結合や外への字下げ戻しもしない', () => {
  assert.throws(() => core.updateStatus(sections, 1, 'done'), { code: 'headingReadOnly' });
  assert.throws(() => core.move(sections, 4, 'up'), { code: 'headingReadOnly' });
  assert.throws(() => core.merge(sections, 5, 'previous'), { code: 'mergeAcrossText' });
  assert.deepEqual(core.outdent(sections, 2), { text: sections, line: 2 });
});

test('節の最初と最後の項目を、画面上で隣の節へ上下に移す', () => {
  assert.deepEqual(core.move(sections, 2, 'up'), { text: sections.replace('- pre\n# A ##\n- a\n  note\n', '- pre\n- a\n  note\n# A ##\n'), line: 1 });
  assert.deepEqual(core.move(sections, 5, 'up'), { text: sections.replace('## A1\n- a1\n', '- a1\n## A1\n'), line: 4 });
  assert.deepEqual(core.move(sections, 2, 'down'), { text: sections.replace('- a\n  note\n## A1\n', '## A1\n- a\n  note\n'), line: 3 });
  assert.deepEqual(core.move(sections, 5, 'down'), { text: sections.replace('- a1\n# B\n```\n# code\n```\n', '# B\n```\n# code\n```\n- a1\n'), line: 9 });
  assert.deepEqual(core.move(sections, 10, 'down'), { text: sections, line: 10 });
});

test('見出しをまたぐ上下移動は、本文を項目に取り込む位置と空の冒頭を拒否する', () => {
  for (const [text, line, direction] of [
    ['# A\n- a\n', 1, 'up'],
    ['# A\nIntro\n# B\n- b\n', 3, 'up'],
    ['# A\n- x\nOutro\n# B\n- b\n', 4, 'up'],
    ['# A\n- a\nText\n# B\n- b\n', 1, 'down'],
  ]) assert.deepEqual(core.move(text, line, direction), { text, line });
});

test('見出しへの移動は節の項目の末尾へ移し、子は最上位の字下げにする', () => {
  assert.deepEqual(core.reparent('# A\n- a\n\n# B\n- b\n', [1], 3), { text: '# A\n\n# B\n- b\n- a\n', line: 4, lines: [4] });
  assert.deepEqual(core.reparent('# A\n- a\n  - c\n# B\n', [2], 3), { text: '# A\n- a\n# B\n- c\n', line: 3, lines: [3] });
  assert.deepEqual(core.reparent('- A\n# Heading\n- target\n', [0], 2), { text: '# Heading\n- target\n  - A\n', line: 2, lines: [2] });
  assert.deepEqual(core.reparent('- target\n  - child\n# Heading\n- moving\n', [3], 0, 1), { text: '- target\n  - moving\n  - child\n# Heading\n', line: 1, lines: [1] });
  assert.throws(() => core.reparent('# A\n- a\n# B\nText\n', [1], 2), { code: 'reparentAcrossText' });
  assert.throws(() => core.reparent('- A\nText\n# H\n- target\n', [0], 3), { code: 'reparentAcrossText' });
  assert.throws(() => core.reparent(sections, [1], 6), { code: 'headingReadOnly' });
});

test('見出しの子の追加は節の項目の先頭に入れ、本文だけの節では拒否する', () => {
  assert.deepEqual(core.insert('# A\n- a\n', 0, { kind: 'bullet', child: true, tags: [] }), { text: '# A\n- \n- a\n', line: 1 });
  assert.deepEqual(core.insert('# A\n## B\n', 0, { kind: 'bullet', child: true, tags: [] }), { text: '# A\n- \n## B\n', line: 1 });
  assert.throws(() => core.insert('# A\nIntro\n', 0, { kind: 'bullet', child: true, tags: [] }), { code: 'insertNextToText' });
  assert.throws(() => core.insert('# A\n- a\n', 0, { kind: 'bullet', tags: [] }), { code: 'headingReadOnly' });
});
