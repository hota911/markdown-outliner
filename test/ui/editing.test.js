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
    expect(depths).toEqual(['0', '1', '2']);
    // Headings and other non-list content are not shown.
    expect(screen.queryByText('Heading')).toBeNull();
  });

  it('shows an empty-state message for a file without list items', async () => {
    const { screen } = await setup({ 'tasks.md': '# Only a heading\n' });
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

  it('Enter during IME composition does not add a task', async () => {
    const { title, titleValues, adapter } = await setup({ 'tasks.md': '- [ ] a\n' });
    const node = title('a');
    node.focus();
    fireEvent.compositionStart(node);
    fireEvent.keyDown(node, { key: 'Enter', keyCode: 229, isComposing: true });
    fireEvent.compositionEnd(node);
    // Some browsers report the confirming Enter without isComposing but with keyCode 229.
    fireEvent.keyDown(node, { key: 'Enter', keyCode: 229 });
    expect(titleValues()).toEqual(['a']);
    expect(adapter.files.get('tasks.md')).toBe('- [ ] a\n');
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
});
