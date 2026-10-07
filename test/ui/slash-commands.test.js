import { describe, expect, it } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/dom';
import { setup } from './harness.js';

const menu = screen => screen.queryByRole('listbox');
// The toolbar's select elements have options too.
const optionNodes = screen => menu(screen) ? within(menu(screen)).getAllByRole('option') : [];
const options = screen => optionNodes(screen).map(node => node.textContent);

describe('opening the / menu', () => {
  it('opens for a / at the start of the text or after a space', async () => {
    const { user, screen, title } = await setup({ 'tasks.md': '- [ ] \n- [ ] Plan\n' });
    await user.type(title(''), '/');
    expect(menu(screen)).toBeTruthy();
    expect(options(screen)).toContain('完了');
    expect(title('/').getAttribute('aria-activedescendant')).toBe(optionNodes(screen)[0].id);
    await user.type(title('Plan'), ' /');
    expect(menu(screen)).toBeTruthy();
  });

  it('does not open for a / inside a word, a full-width ／, or in a note', async () => {
    const { user, screen, title } = await setup({ 'tasks.md': '- [ ] A\n  memo\n' });
    await user.type(title('A'), '/B https://example.com/x ／');
    expect(menu(screen)).toBeNull();
    await user.type(screen.getByRole('textbox', { name: '項目のノート' }), ' /');
    expect(menu(screen)).toBeNull();
  });

  it('does not open during an IME composition or for the input that commits it', async () => {
    const { screen, title } = await setup({ 'tasks.md': '- [ ] \n' });
    const node = title('');
    node.focus();
    fireEvent.compositionStart(node);
    node.value = '/';
    node.setSelectionRange(1, 1);
    fireEvent.input(node, { inputType: 'insertCompositionText', data: '/', isComposing: true });
    expect(menu(screen)).toBeNull();
    fireEvent.compositionEnd(node);
    fireEvent.input(node, { inputType: 'insertFromComposition', data: '/' });
    expect(menu(screen)).toBeNull();
  });
});

describe('typing a command with an IME', () => {
  // Sets the text as an IME does while composing: the reading, then the converted clause selected.
  const compose = (node, value, start, end = start) => {
    node.value = value;
    node.setSelectionRange(start, end);
    fireEvent.input(node, { inputType: 'insertCompositionText', data: value.slice(value.indexOf('/') + 1), isComposing: true });
  };

  it('shows a command for its reading in hiragana while composing', async () => {
    const { user, screen, title } = await setup({ 'tasks.md': '- [ ] Plan\n' });
    await user.type(title('Plan'), ' /');
    const node = title('Plan /');
    fireEvent.compositionStart(node);
    compose(node, 'Plan /かんりょう', 11);
    await waitFor(() => expect(options(screen)).toEqual(['完了']));
  });

  it('keeps the menu open while the clause is converted, and Enter runs the command after the commit', async () => {
    const { user, screen, title, titleValues, saved } = await setup({ 'tasks.md': '- [ ] Plan\n' });
    await user.type(title('Plan'), ' /');
    const node = title('Plan /');
    fireEvent.compositionStart(node);
    compose(node, 'Plan /かんりょう', 11);
    // Space converts the reading, and the browser selects the converted clause.
    compose(node, 'Plan /完了', 6, 8);
    await waitFor(() => expect(options(screen)).toEqual(['完了']));
    // The Enter that commits the composition does not run the command.
    fireEvent.keyDown(node, { key: 'Enter', keyCode: 229, isComposing: true });
    node.setSelectionRange(8, 8);
    fireEvent.compositionEnd(node, { data: '完了' });
    expect(titleValues()).toEqual(['Plan /完了']);
    await waitFor(() => expect(options(screen)).toEqual(['完了']));
    expect(optionNodes(screen)[0].getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Enter}');
    expect(menu(screen)).toBeNull();
    expect(await saved()).toBe('- [x] Plan\n');
  });

  it('keeps the menu open from `/のーと` to the converted `/ノート`, and Enter opens the note', async () => {
    const { user, screen, title } = await setup({ 'tasks.md': '- [ ] \n' });
    await user.type(title(''), '/');
    const node = title('/');
    fireEvent.compositionStart(node);
    compose(node, '/のーと', 4);
    await waitFor(() => expect(options(screen)).toEqual(['ノート']));
    compose(node, '/ノート', 1, 4);
    await waitFor(() => expect(options(screen)).toEqual(['ノート']));
    node.setSelectionRange(4, 4);
    fireEvent.compositionEnd(node, { data: 'ノート' });
    await waitFor(() => expect(options(screen)).toEqual(['ノート']));
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '項目のノート' }));
  });

  it('matches katakana, hiragana and half-width forms of a command alike', async () => {
    const { user, screen, title } = await setup({ 'tasks.md': '- [ ] \n' });
    await user.type(title(''), '/ﾉｰﾄ');
    expect(options(screen)).toEqual(['ノート']);
    await user.keyboard('{Backspace>3/}カンリョウ');
    expect(options(screen)).toEqual(['完了']);
  });

  it('closes the menu when the committed text has a space', async () => {
    const { user, screen, title } = await setup({ 'tasks.md': '- [ ] Plan\n' });
    await user.type(title('Plan'), ' /');
    const node = title('Plan /');
    fireEvent.compositionStart(node);
    compose(node, 'Plan /完了　', 9);
    expect(menu(screen)).toBeTruthy();
    fireEvent.compositionEnd(node);
    await waitFor(() => expect(menu(screen)).toBeNull());
  });
});

describe('using the / menu', () => {
  it('filters by the English and Japanese labels and keywords', async () => {
    const { user, screen, title } = await setup({ 'tasks.md': '- [ ] \n' });
    await user.type(title(''), '/done');
    expect(options(screen)).toEqual(['完了']);
    await user.keyboard('{Backspace>4/}完了');
    expect(options(screen)).toEqual(['完了']);
    await user.keyboard('{Backspace>2/}emb');
    expect(options(screen)).toEqual(['既存のファイルを埋め込む']);
  });

  it('offers the conversion to a bullet only for tasks, and the one to a task only for bullets', async () => {
    const { user, screen, title } = await setup({ 'tasks.md': '- [ ] a\n- b\n' });
    await user.type(title('a'), ' /');
    expect(options(screen)).toContain('箇条書きにする');
    expect(options(screen)).not.toContain('タスクにする');
    await user.type(title('b'), ' /');
    expect(options(screen)).toContain('タスクにする');
    expect(options(screen)).not.toContain('箇条書きにする');
  });

  it('Escape and a space close the menu and keep the text; without a match Enter adds an item', async () => {
    const { user, screen, title, titleValues } = await setup({ 'tasks.md': '- [ ] a\n' });
    await user.type(title('a'), ' /do');
    await user.keyboard('{Escape}');
    expect(menu(screen)).toBeNull();
    expect(titleValues()).toEqual(['a /do']);
    await user.keyboard(' /do ');
    expect(menu(screen)).toBeNull();
    await user.keyboard('/zzz');
    expect(menu(screen)).toBeNull();
    await user.keyboard('{Enter}');
    expect(titleValues()).toEqual(['a /do /do /zzz', '']);
  });

  it('Enter runs the highlighted command: the status changes, the /query text goes, and one undo brings both back', async () => {
    const { user, screen, title, titleValues, saved } = await setup({ 'tasks.md': '- [ ] Plan\n- [ ] b\n' });
    await user.type(title('Plan'), ' /done');
    await user.keyboard('{Enter}');
    expect(menu(screen)).toBeNull();
    expect(document.activeElement).toBe(title('Plan'));
    expect(title('Plan').selectionStart).toBe(4);
    expect(await saved()).toBe('- [x] Plan\n- [ ] b\n');
    await user.click(title('Plan'));
    await user.keyboard('{Control>}z{/Control}');
    expect(titleValues()).toEqual(['Plan /done', 'b']);
    expect(await saved()).toBe('- [ ] Plan /done\n- [ ] b\n');
    await user.keyboard('{Control>}z{/Control}');
    expect(titleValues()).toEqual(['Plan', 'b']);
  });

  it('the arrows move the highlight, Tab runs it, and a status command turns a bullet into a task', async () => {
    const { user, screen, title, saved } = await setup({ 'tasks.md': '- a\n' });
    await user.type(title('a'), ' /');
    expect(options(screen).slice(0, 3)).toEqual(['未着手', '進行中', '完了']);
    await user.keyboard('{ArrowDown}');
    expect(optionNodes(screen)[1].getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(optionNodes(screen).at(-1).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowDown}{ArrowDown}{Tab}');
    expect(await saved()).toBe('- [/] a\n');
  });

  it('clicking a command runs it, and the bullet command drops the status', async () => {
    const { user, screen, title, saved } = await setup({ 'tasks.md': '- [/] a /x\n' });
    await user.type(title('a /x'), ' /bul');
    await user.click(screen.getByRole('option', { name: '箇条書きにする' }));
    expect(await saved()).toBe('- a /x\n');
  });

  it('the note and zoom commands remove the text and open the note or zoom in', async () => {
    const { user, screen, title, saved } = await setup({ 'tasks.md': '- [ ] a\n  - [ ] child\n' });
    await user.type(title('a'), ' /note');
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '項目のノート' }));
    expect(await saved()).toBe('- [ ] a\n  - [ ] child\n');
    await user.type(title('a'), ' /zoom');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: 'ズーム対象のタイトル' }).value).toBe('a');
  });

  it('the extract command moves the item without the /query text to a new file', async () => {
    const { user, screen, title, adapter } = await setup({ 'tasks.md': '- [ ] Plan\n' });
    await user.type(title('Plan'), ' /ファイルにする');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('ファイル: Plan.md')).toBeTruthy());
    expect(adapter.files.get('Plan.md')).toBe('- [ ] Plan\n');
  });
});

describe('embedding an existing file from the / menu', () => {
  const files = { 'notes/tasks.md': '- [ ] Plan\n- [ ] \n', 'notes/work.md': '- [ ] Work task\n', 'other/ref.md': '- [ ] Ref task\n' };

  it('lists the other files, filters them, and turns an empty item into the embed', async () => {
    const { user, screen, title, saved } = await setup(files, { initialFile: 'notes/tasks.md' });
    await user.type(title(''), '/emb');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(options(screen)).toEqual(['notes/work.md', 'other/ref.md']));
    expect(title('/')).toBeTruthy();
    await user.keyboard('wor');
    expect(options(screen)).toEqual(['notes/work.md']);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('ファイル: work.md')).toBeTruthy());
    expect(title('Work task')).toBeTruthy();
    expect(await saved('notes/tasks.md')).toBe('- [ ] Plan\n- ![[work.md]]\n');
    // The embed and the removal of the /query text are one undo step.
    await user.click(title('Plan'));
    await user.keyboard('{Control>}z{/Control}');
    expect(await saved('notes/tasks.md')).toBe('- [ ] Plan\n- [ ] /wor\n');
  });

  it('inserts the embed below an item with text, with a path relative to its folder', async () => {
    const { user, screen, title, saved } = await setup(files, { initialFile: 'notes/tasks.md' });
    await user.type(title('Plan'), ' /emb');
    await user.click(screen.getByRole('option', { name: '既存のファイルを埋め込む' }));
    await waitFor(() => expect(options(screen)).toContain('other/ref.md'));
    await user.click(within(menu(screen)).getByRole('option', { name: 'other/ref.md' }));
    await waitFor(() => expect(screen.getByText('ファイル: ../other/ref.md')).toBeTruthy());
    expect(title('Ref task')).toBeTruthy();
    expect(await saved('notes/tasks.md')).toBe('- [ ] Plan\n- ![[../other/ref.md]]\n- [ ] \n');
  });

  it('Escape goes back from the file list to the commands', async () => {
    const { user, screen, title } = await setup(files, { initialFile: 'notes/tasks.md' });
    await user.type(title(''), '/emb');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(options(screen)).toContain('other/ref.md'));
    await user.keyboard('{Escape}');
    expect(options(screen)).toContain('完了');
    await user.keyboard('{Escape}');
    expect(menu(screen)).toBeNull();
    expect(title('/')).toBeTruthy();
  });
});
