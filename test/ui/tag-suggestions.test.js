import { describe, expect, it } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/dom';
import { setup } from './harness.js';

const menu = screen => screen.queryByRole('listbox');
const optionNodes = screen => menu(screen) ? within(menu(screen)).getAllByRole('option') : [];
const options = screen => optionNodes(screen).map(node => node.textContent);

const files = {
  'tasks.md': '- [ ] Plan #work\n- [ ] Trip #travel #プロジェクト/旅行\n  note #reading\n- [ ] \n- [ ] Code #1234 a#b\n',
};

describe('opening the # menu', () => {
  it('lists the tags of the loaded files for a # at the start or after a space', async () => {
    const { user, screen, title } = await setup(files);
    await user.type(title(''), '#');
    expect(menu(screen).getAttribute('aria-label')).toBe('タグ');
    // Purely numeric words and `#` inside a word are no tags.
    expect(options(screen)).toEqual(['#reading', '#travel', '#work', '#プロジェクト/旅行']);
    await user.type(title('Plan #work'), ' #');
    expect(menu(screen)).toBeTruthy();
  });

  it('does not open for a # inside a word, a full-width ＃, or in a note', async () => {
    const { user, screen, title } = await setup(files);
    await user.type(title(''), 'a# ＃');
    expect(menu(screen)).toBeNull();
    await user.click(title('Plan #work'));
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.keyboard(' #');
    expect(menu(screen)).toBeNull();
  });

  it('does not offer the word right after the # being typed', async () => {
    const { user, screen, title } = await setup({ 'tasks.md': '- [ ] draft\n- [ ] #done\n' });
    const node = title('draft');
    await user.click(node);
    node.setSelectionRange(0, 0);
    await user.keyboard('#');
    expect(options(screen)).toEqual(['#done']);
  });

  it('adds the tags the host lists for all its files', async () => {
    const { user, screen, title } = await setup(files, { tags: async () => ['work', 'archive'] });
    await user.type(title(''), '#');
    await waitFor(() => expect(options(screen)).toEqual(['#archive', '#reading', '#travel', '#work', '#プロジェクト/旅行']));
  });

  it('shows the error of the host and keeps the tags of the loaded files', async () => {
    const { user, screen, title } = await setup(files, { tags: async () => { throw new Error('タグを読めません'); } });
    await user.type(title(''), '#');
    await waitFor(() => expect(screen.getByText('タグを読めません')).toBeTruthy());
    expect(options(screen)).toContain('#work');
  });
});

describe('filtering and choosing a tag', () => {
  it('ranks tags starting with the query before tags containing it', async () => {
    const { user, screen, title } = await setup({ 'tasks.md': '- [ ] #aab #abz #xyz\n- [ ] \n' });
    await user.type(title(''), '#ab');
    expect(options(screen)).toEqual(['#abz', '#aab']);
  });

  it('matches katakana, hiragana and half-width forms alike', async () => {
    const { user, screen, title } = await setup(files);
    await user.type(title(''), '#ぷろ');
    expect(options(screen)).toEqual(['#プロジェクト/旅行']);
    await user.keyboard('{Backspace>2/}ﾌﾟﾛ');
    expect(options(screen)).toEqual(['#プロジェクト/旅行']);
  });

  it('Enter replaces #query with the tag and a space, and puts the caret after it', async () => {
    const { user, screen, title, saved } = await setup({ 'tasks.md': '- [ ] #travel\n- [ ] Plan\n' });
    const node = title('Plan');
    await user.click(node);
    await user.keyboard('{End} #tr');
    await user.keyboard('{Enter}');
    expect(menu(screen)).toBeNull();
    expect(document.activeElement).toBe(title('Plan #travel '));
    expect(document.activeElement.selectionStart).toBe(13);
    await user.keyboard('x');
    expect(title('Plan #travel x')).toBeTruthy();
    expect(await saved()).toBe('- [ ] #travel\n- [ ] Plan #travel x\n');
  });

  it('in the middle of the text, Tab and a click keep the following space', async () => {
    const { user, screen, title, saved } = await setup({ 'tasks.md': '- [ ] #work #walk\n- [ ] a b\n' });
    const node = title('a b');
    await user.click(node);
    node.setSelectionRange(1, 1);
    await user.keyboard(' #w{ArrowDown}{Tab}');
    expect(title('a #work b').selectionStart).toBe(8);
    await user.keyboard('#');
    await user.click(screen.getByRole('option', { name: '#walk' }));
    expect(await saved()).toBe('- [ ] #work #walk\n- [ ] a #work #walk b\n');
  });

  it('closes without a match, so a new tag and Enter work as usual', async () => {
    const { user, screen, title, titleValues } = await setup({ 'tasks.md': '- [ ] #work\n- [ ] a\n' });
    await user.type(title('a'), ' #new');
    expect(menu(screen)).toBeNull();
    await user.keyboard('{Enter}');
    expect(titleValues()).toEqual(['#work', 'a #new', '']);
  });

  it('closes when the only match is the tag typed out in full', async () => {
    const { user, screen, title } = await setup({ 'tasks.md': '- [ ] #work\n- [ ] a\n' });
    await user.type(title('a'), ' #wor');
    expect(options(screen)).toEqual(['#work']);
    await user.keyboard('k');
    expect(menu(screen)).toBeNull();
  });

  it('Escape and a space close the menu and keep the text', async () => {
    const { user, screen, title, titleValues } = await setup({ 'tasks.md': '- [ ] #work\n- [ ] a\n' });
    await user.type(title('a'), ' #w');
    await user.keyboard('{Escape}');
    expect(menu(screen)).toBeNull();
    await user.keyboard(' #w');
    expect(menu(screen)).toBeTruthy();
    await user.keyboard(' ');
    expect(menu(screen)).toBeNull();
    expect(titleValues()).toEqual(['#work', 'a #w #w ']);
  });
});

describe('typing a tag with an IME', () => {
  const compose = (node, value, start, end = start) => {
    node.value = value;
    node.setSelectionRange(start, end);
    fireEvent.input(node, { inputType: 'insertCompositionText', data: value.slice(value.indexOf('#') + 1), isComposing: true });
  };

  it('keeps the menu open through the conversion, and Enter chooses the tag after the commit', async () => {
    const { user, screen, title, saved } = await setup({ 'tasks.md': '- [ ] #プロジェクト\n- [ ] Plan\n' });
    await user.type(title('Plan'), ' #');
    const node = title('Plan #');
    fireEvent.compositionStart(node);
    compose(node, 'Plan #ぷろ', 8);
    await waitFor(() => expect(options(screen)).toEqual(['#プロジェクト']));
    compose(node, 'Plan #プロ', 6, 8);
    await waitFor(() => expect(options(screen)).toEqual(['#プロジェクト']));
    // The Enter that commits the composition does not choose the tag.
    fireEvent.keyDown(node, { key: 'Enter', keyCode: 229, isComposing: true });
    node.setSelectionRange(8, 8);
    fireEvent.compositionEnd(node, { data: 'プロ' });
    await waitFor(() => expect(options(screen)).toEqual(['#プロジェクト']));
    await user.keyboard('{Enter}');
    expect(menu(screen)).toBeNull();
    expect(await saved()).toBe('- [ ] #プロジェクト\n- [ ] Plan #プロジェクト \n');
  });

  it('does not open for a # typed during a composition', async () => {
    const { screen, title } = await setup({ 'tasks.md': '- [ ] #work\n- [ ] \n' });
    const node = title('');
    node.focus();
    fireEvent.compositionStart(node);
    node.value = '#';
    node.setSelectionRange(1, 1);
    fireEvent.input(node, { inputType: 'insertCompositionText', data: '#', isComposing: true });
    fireEvent.compositionEnd(node);
    fireEvent.input(node, { inputType: 'insertFromComposition', data: '#' });
    expect(menu(screen)).toBeNull();
  });
});
