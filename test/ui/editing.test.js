import { describe, expect, it } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/dom';
import { setup } from './harness.js';

describe('rendering', () => {
  it('shows tasks, bullets, statuses and nesting from Markdown', async () => {
    const { screen, titleValues, row } = await setup({
      'tasks.md': '# Heading\n\n- [ ] todo\n  - [/] doing\n    - [x] done\n- plain bullet\n  note line\n',
    });
    expect(titleValues()).toEqual(['todo', 'doing', 'done', 'plain bullet']);
    expect(row('todo').getByRole('button', { name: '未着手（クリックで進行中）' })).toBeTruthy();
    expect(row('doing').getByRole('button', { name: '進行中（クリックで完了）' })).toBeTruthy();
    expect(row('done').getByRole('button', { name: '完了（クリックで未着手）' })).toBeTruthy();
    expect(row('plain bullet').queryByRole('button', { name: /クリックで/ })).toBeNull();
    expect(row('plain bullet').getByRole('textbox', { name: '項目のノート' }).value).toBe('note line');
    const depths = ['todo', 'doing', 'done'].map(value => row(value).getByRole('textbox', { name: '項目の内容' }).closest('.outline-item').style.getPropertyValue('--depth'));
    // The items are children of the heading, which is shown as a read-only row.
    expect(depths).toEqual(['1', '2', '3']);
    expect(screen.getByRole('heading', { level: 1, name: 'Heading' })).toBeTruthy();
  });

  it('shows an empty-state message for a file without list items', async () => {
    const { screen } = await setup({ 'tasks.md': 'Only a paragraph\n' });
    expect(screen.getByText('表示する項目がありません。「＋」で入力できます。')).toBeTruthy();
  });
});

describe('editing titles and notes', () => {
  it('saves an edited title back to Markdown and keeps other content', async () => {
    const { user, title, saved } = await setup({ 'tasks.md': '# Plan\n\n- [ ] write\n- [x] read\n' });
    await user.type(title('write'), ' tests');
    expect(await saved()).toBe('# Plan\n\n- [ ] write tests\n- [x] read\n');
  });

  it('auto-saves shortly after the last edit', async () => {
    const { user, title, adapter } = await setup({ 'tasks.md': '- [ ] a\n' });
    await user.type(title('a'), 'b');
    await waitFor(() => expect(adapter.files.get('tasks.md')).toBe('- [ ] ab\n'), { timeout: 2000 });
  });

  it('replaces a newline pasted into a title with a space', async () => {
    const { user, title, saved } = await setup({ 'tasks.md': '- [ ] a\n' });
    await user.click(title('a'));
    await user.paste('b\nc');
    expect(await saved()).toBe('- [ ] ab c\n');
  });

  it('Shift+Enter opens the note of the item and the note is saved', async () => {
    const { user, screen, title, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n' });
    await user.click(title('a'));
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    const note = screen.getByRole('textbox', { name: '項目のノート' });
    expect(document.activeElement).toBe(note);
    await user.keyboard('memo');
    expect(await saved()).toBe('- [ ] a\n  memo\n- [ ] b\n');
  });
});

describe('keyboard structure editing', () => {
  it('Enter adds a sibling task after the item and focuses it', async () => {
    const { user, title, titles, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] c\n' });
    await user.click(title('a'));
    await user.keyboard('{Enter}');
    expect(titles().map(node => node.value)).toEqual(['a', '', 'c']);
    expect(document.activeElement).toBe(titles()[1]);
    await user.keyboard('b');
    expect(await saved()).toBe('- [ ] a\n- [ ] b\n- [ ] c\n');
  });

  it('Enter after a bullet adds a bullet', async () => {
    const { user, title, saved } = await setup({ 'tasks.md': '- a\n' });
    await user.click(title('a'));
    await user.keyboard('{Enter}b');
    expect(await saved()).toBe('- a\n- b\n');
  });

  it('Enter at the start of a text adds an item above and keeps the caret at the start of the item', async () => {
    const { user, title, titles, saved } = await setup({ 'tasks.md': '- [ ] a\n- [/] b\n  memo\n  - [ ] child\n' });
    await user.click(title('b'));
    title('b').setSelectionRange(0, 0);
    await user.keyboard('{Enter}{Enter}');
    expect(titles().map(node => node.value)).toEqual(['a', '', '', 'b', 'child']);
    expect(document.activeElement).toBe(titles()[3]);
    expect(titles()[3].selectionStart).toBe(0);
    await user.keyboard('x');
    expect(await saved()).toBe('- [ ] a\n- [ ] \n- [ ] \n- [/] xb\n  memo\n  - [ ] child\n');
  });

  it('Enter at the start of a bullet adds a bullet above, and one undo removes it', async () => {
    const { user, title, titleValues, saved } = await setup({ 'tasks.md': '- a\n' });
    await user.click(title('a'));
    title('a').setSelectionRange(0, 0);
    await user.keyboard('{Enter}');
    expect(await saved()).toBe('- \n- a\n');
    await user.keyboard('{Control>}z{/Control}');
    expect(titleValues()).toEqual(['a']);
  });

  it('Enter at the start of an empty text or with selected text adds an item after it', async () => {
    const { user, title, titleValues } = await setup({ 'tasks.md': '- [ ] \n- [ ] ab\n' });
    await user.click(title(''));
    await user.keyboard('{Enter}');
    expect(titleValues()).toEqual(['', '', 'ab']);
    await user.click(title('ab'));
    title('ab').setSelectionRange(0, 1);
    await user.keyboard('{Enter}');
    expect(titleValues()).toEqual(['', '', 'ab', '']);
  });

  it('Enter at the start of the zoomed item adds a child', async () => {
    const { user, screen, row, titleValues } = await setup({ 'tasks.md': '- [ ] a\n  - [ ] child\n' });
    await user.click(row('a').getByTitle('この項目にズーム'));
    const zoomTitle = screen.getByRole('textbox', { name: 'ズーム対象のタイトル' });
    await user.click(zoomTitle);
    zoomTitle.setSelectionRange(0, 0);
    await user.keyboard('{Enter}');
    expect(titleValues()).toEqual(['', 'child']);
  });

  it('Enter during IME composition does not add a task', async () => {
    const { title, titleValues, adapter } = await setup({ 'tasks.md': '- [ ] a\n' });
    const node = title('a');
    node.focus();
    // The caret at the start would add the item above without composition.
    node.setSelectionRange(0, 0);
    fireEvent.compositionStart(node);
    fireEvent.keyDown(node, { key: 'Enter', keyCode: 229, isComposing: true });
    fireEvent.compositionEnd(node);
    // Some browsers report the confirming Enter without isComposing but with keyCode 229.
    fireEvent.keyDown(node, { key: 'Enter', keyCode: 229 });
    expect(titleValues()).toEqual(['a']);
    expect(adapter.files.get('tasks.md')).toBe('- [ ] a\n');
  });

  // Soft keyboards keep the word being typed in composition; the touch bar commits it first.
  it('the touch bar indents an item whose title is in IME composition, and the title keeps the focus', async () => {
    const { user, screen, title, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n' });
    const node = title('b');
    await user.click(node);
    fireEvent.compositionStart(node);
    await user.click(screen.getByRole('button', { name: '字下げ（Tab）' }));
    expect(document.activeElement).toBe(title('b'));
    expect(await saved()).toBe('- [ ] a\n  - [ ] b\n');
  });

  it('Tab indents and Shift+Tab outdents', async () => {
    const { user, title, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n' });
    await user.click(title('b'));
    await user.keyboard('{Tab}');
    expect(await saved()).toBe('- [ ] a\n  - [ ] b\n');
    await user.click(title('b'));
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(await saved()).toBe('- [ ] a\n- [ ] b\n');
  });

  it('Backspace at the start merges the item into the previous one', async () => {
    const { user, title, titleValues, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n' });
    await user.type(title('b'), '{Backspace}', { initialSelectionStart: 0, initialSelectionEnd: 0 });
    expect(titleValues()).toEqual(['ab']);
    expect(document.activeElement.selectionStart).toBe(1);
    expect(await saved()).toBe('- [ ] ab\n');
  });

  it('Delete at the end merges the next item into this one', async () => {
    const { user, title, titleValues, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n' });
    await user.type(title('a'), '{Delete}');
    expect(titleValues()).toEqual(['ab']);
    expect(document.activeElement.selectionStart).toBe(1);
    expect(await saved()).toBe('- [ ] ab\n');
  });

  it('Backspace in the middle of a title edits text instead of merging', async () => {
    const { user, title, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] bc\n' });
    await user.type(title('bc'), '{Backspace}', { initialSelectionStart: 1, initialSelectionEnd: 1 });
    expect(await saved()).toBe('- [ ] a\n- [ ] c\n');
  });

  const filterTodo = screen => screen.getByRole('combobox', { name: '表示する状態' });

  it('Backspace merges with the previous item on screen and leaves the items hidden by the filter', async () => {
    const { user, screen, title, titleValues, saved } = await setup({ 'tasks.md': '- [ ] a\n- [x] hidden\n- [ ] b\n' });
    await user.selectOptions(filterTodo(screen), 'todo');
    await user.type(title('b'), '{Backspace}', { initialSelectionStart: 0, initialSelectionEnd: 0 });
    expect(titleValues()).toEqual(['ab']);
    expect(document.activeElement.selectionStart).toBe(1);
    expect(await saved()).toBe('- [ ] ab\n- [x] hidden\n');
  });

  it('Delete merges the next item on screen and leaves the items hidden by the filter', async () => {
    const { user, screen, title, titleValues, saved } = await setup({ 'tasks.md': '- [ ] a\n- [x] hidden\n- [ ] b\n' });
    await user.selectOptions(filterTodo(screen), 'todo');
    await user.type(title('a'), '{Delete}');
    expect(titleValues()).toEqual(['ab']);
    expect(document.activeElement.selectionStart).toBe(1);
    expect(await saved()).toBe('- [ ] ab\n- [x] hidden\n');
  });

  it('Backspace in an empty item deletes it past the hidden items and moves to the end of the previous item on screen', async () => {
    const { user, screen, title, titleValues, saved } = await setup({ 'tasks.md': '- [ ] a\n- [x] hidden\n- [ ] \n' });
    await user.selectOptions(filterTodo(screen), 'todo');
    await user.type(title(''), '{Backspace}');
    expect(titleValues()).toEqual(['a']);
    expect(document.activeElement).toBe(title('a'));
    expect(document.activeElement.selectionStart).toBe(1);
    expect(await saved()).toBe('- [ ] a\n- [x] hidden\n');
  });

  it('Backspace does not merge an item with children past hidden items', async () => {
    const { user, screen, title, titleValues, adapter } = await setup({ 'tasks.md': '- [ ] a\n- [x] hidden\n- [ ] b\n  - [ ] c\n' });
    await user.selectOptions(filterTodo(screen), 'todo');
    await user.type(title('b'), '{Backspace}', { initialSelectionStart: 0, initialSelectionEnd: 0 });
    expect(titleValues()).toEqual(['a', 'b', 'c']);
    expect(screen.getByText('間に隠れた項目があるため、子タスクのある項目は結合できません')).toBeTruthy();
    expect(adapter.files.get('tasks.md')).toBe('- [ ] a\n- [x] hidden\n- [ ] b\n  - [ ] c\n');
  });

  it('Backspace merges with a folded item and keeps its hidden children', async () => {
    const { user, row, title, titleValues, saved } = await setup({ 'tasks.md': '- [ ] a\n  - [ ] child\n- [ ] b\n' });
    await user.click(row('a').getByTitle('子項目を折りたたむ／開く'));
    await user.type(title('b'), '{Backspace}', { initialSelectionStart: 0, initialSelectionEnd: 0 });
    expect(titleValues()).toEqual(['ab']);
    expect(await saved()).toBe('- [ ] ab\n  - [ ] child\n');
  });

  it('Alt+ArrowUp / Alt+ArrowDown move an item among its siblings', async () => {
    const { user, title, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n' });
    await user.click(title('b'));
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(await saved()).toBe('- [ ] b\n- [ ] a\n');
    await user.click(title('b'));
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(await saved()).toBe('- [ ] a\n- [ ] b\n');
  });

  it('ArrowUp / ArrowDown move the focus between titles', async () => {
    const { user, title } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n' });
    await user.click(title('a'));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(title('b'));
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(title('a'));
  });

  it('on macOS, Ctrl+P / Ctrl+N move the focus between titles as ↑↓ do', async () => {
    const { user, title } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n' }, { mac: true });
    await user.click(title('a'));
    await user.keyboard('{Control>}n{/Control}');
    expect(document.activeElement).toBe(title('b'));
    await user.keyboard('{Control>}p{/Control}');
    expect(document.activeElement).toBe(title('a'));
  });

  it('elsewhere, Ctrl+P / Ctrl+N are left to the app and the browser', async () => {
    const { user, title } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n' }, { mac: false });
    await user.click(title('a'));
    await user.keyboard('{Control>}n{/Control}');
    expect(document.activeElement).toBe(title('a'));
  });
});

describe('deleting items', () => {
  const handle = (row, value) => row(value).getByTitle('項目を選択／ドラッグして移動');

  it('Ctrl+Shift+Backspace deletes the item with its children and focuses the end of the item above', async () => {
    const { user, screen, title, titleValues, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n  note\n  - [ ] b1\n- [ ] c\n' });
    await user.click(title('b'));
    await user.keyboard('{Control>}{Shift>}{Backspace}{/Shift}{/Control}');
    expect(titleValues()).toEqual(['a', 'c']);
    expect(document.activeElement).toBe(title('a'));
    expect(document.activeElement.selectionStart).toBe(1);
    expect(screen.getByRole('status').textContent).toBe('子項目を含めて 2 項目を削除しました。Undo で戻せます。');
    expect(await saved()).toBe('- [ ] a\n- [ ] c\n');
    await user.click(screen.getByTitle('元に戻す'));
    expect(await saved()).toBe('- [ ] a\n- [ ] b\n  note\n  - [ ] b1\n- [ ] c\n');
  });

  it('uses ⌘+Shift+Backspace on macOS, and focuses the item below when none is above', async () => {
    const { user, title, titleValues, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n' }, { mac: true });
    await user.click(title('a'));
    await user.keyboard('{Meta>}{Shift>}{Backspace}{/Shift}{/Meta}');
    expect(titleValues()).toEqual(['b']);
    expect(document.activeElement).toBe(title('b'));
    expect(await saved()).toBe('- [ ] b\n');
  });

  it('deletes the focused item and the items hidden under it by a filter, skipping hidden neighbors for the focus', async () => {
    const { user, screen, title, titleValues, saved } = await setup({ 'tasks.md': '- [ ] a\n- [x] hidden\n- [ ] b\n  - [x] done child\n' });
    await user.selectOptions(screen.getByRole('combobox', { name: '表示する状態' }), 'todo');
    expect(titleValues()).toEqual(['a', 'b']);
    await user.click(title('b'));
    await user.keyboard('{Control>}{Shift>}{Backspace}{/Shift}{/Control}');
    expect(document.activeElement).toBe(title('a'));
    expect(screen.getByRole('status').textContent).toContain('2 項目');
    expect(await saved()).toBe('- [ ] a\n- [x] hidden\n');
  });

  it('the selection bar deletes the selected items, and the shortcut on a selected item deletes them all', async () => {
    const { user, screen, row, title, titleValues, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n' });
    await user.click(handle(row, 'a'));
    await user.keyboard('{Shift>}');
    await user.click(handle(row, 'b'));
    await user.keyboard('{/Shift}');
    await user.click(screen.getByRole('button', { name: '削除' }));
    expect(titleValues()).toEqual(['c', 'd']);
    expect(screen.queryByText(/項目を選択$/)).toBeNull();
    expect(await saved()).toBe('- [ ] c\n- [ ] d\n');
    await user.click(handle(row, 'c'));
    await user.keyboard('{Shift>}');
    await user.click(handle(row, 'd'));
    await user.keyboard('{/Shift}');
    await user.click(title('d'));
    await user.keyboard('{Control>}{Shift>}{Backspace}{/Shift}{/Control}');
    expect(await saved()).toBe('');
  });

  it('the shortcut on a focused handle deletes an embed line but not the embedded file', async () => {
    const { user, row, adapter, saved } = await setup({ 'tasks.md': '- [ ] a\n- ![[work.md]]\n', 'work.md': '- [ ] w\n' });
    const embedHandle = row('w').getByTitle('項目を選択／ドラッグして移動').closest('.outline-item').parentElement.closest('.outline-item').querySelector('.drag-handle');
    embedHandle.focus();
    await user.keyboard('{Control>}{Shift>}{Backspace}{/Shift}{/Control}');
    expect(await saved()).toBe('- [ ] a\n');
    expect(adapter.files.get('work.md')).toBe('- [ ] w\n');
  });

  it('/削除 deletes the item, and one undo brings it back with the /query text, as for other commands', async () => {
    const { user, screen, title, titleValues, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n' });
    await user.type(title('b'), ' /削除');
    await user.keyboard('{Enter}');
    expect(titleValues()).toEqual(['a']);
    expect(await saved()).toBe('- [ ] a\n');
    await user.click(screen.getByTitle('元に戻す'));
    expect(await saved()).toBe('- [ ] a\n- [ ] b /削除\n');
  });

  it('does not delete the zoomed item', async () => {
    const { user, screen, row, titleValues } = await setup({ 'tasks.md': '- [ ] a\n  - [ ] a1\n' });
    await user.click(row('a').getByTitle('この項目にズーム'));
    screen.getByRole('textbox', { name: 'ズーム対象のタイトル' }).focus();
    await user.keyboard('{Control>}{Shift>}{Backspace}{/Shift}{/Control}');
    expect(titleValues()).toContain('a1');
    expect(screen.getByRole('status').textContent).toBe('ズーム中の項目は削除できません。先にズームを解除してください。');
  });
});
