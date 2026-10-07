import { describe, expect, it } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import { flush, setup } from './harness.js';

describe('status button', () => {
  it('cycles todo -> in-progress -> done -> todo, one click each', async () => {
    const { user, row, saved } = await setup({ 'tasks.md': '- [ ] a\n' });
    await user.click(row('a').getByRole('button', { name: '未着手（クリックで進行中）' }));
    expect(await saved()).toBe('- [/] a\n');
    await user.click(row('a').getByRole('button', { name: '進行中（クリックで完了）' }));
    expect(await saved()).toBe('- [x] a\n');
    expect(row('a').getByRole('textbox', { name: '項目の内容' }).closest('.outline-item').classList.contains('is-done')).toBe(true);
    await user.click(row('a').getByRole('button', { name: '完了（クリックで未着手）' }));
    expect(await saved()).toBe('- [ ] a\n');
  });

  // Regression: leaving a title by pressing the status button blurs the title, the blur
  // triggers a re-render, and a re-render between pointerdown and pointerup used to
  // replace the button so the browser never delivered the click.
  it('changes the status with one click while a title is being edited', async () => {
    const { user, title, row, saved } = await setup({ 'tasks.md': '- [ ] a\n' });
    await user.click(title('a'));
    const target = row('a').getByRole('button', { name: '未着手（クリックで進行中）' });
    fireEvent.pointerDown(target);
    title('a').blur();
    await flush();
    fireEvent.pointerUp(target);
    // Browsers only fire click when the pressed element is still in the document.
    expect(target.isConnected).toBe(true);
    fireEvent.click(target);
    await flush();
    expect(row('a').getByRole('button', { name: '進行中（クリックで完了）' })).toBeTruthy();
    expect(await saved()).toBe('- [/] a\n');
  });

  it('Ctrl+Enter completes an in-progress task', async () => {
    const { user, title, saved } = await setup({ 'tasks.md': '- [/] a\n- [ ] b\n' });
    await user.click(title('a'));
    await user.keyboard('{Control>}{Enter}{/Control}');
    await user.click(title('b'));
    await user.keyboard('{Control>}{Enter}{/Control}');
    // Only in-progress tasks are completed.
    expect(await saved()).toBe('- [x] a\n- [ ] b\n');
  });

  it('selected siblings get a status together', async () => {
    const { user, screen, row, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n- [ ] c\n' });
    await user.click(row('a').getByTitle('項目を選択／ドラッグして移動'));
    await user.keyboard('{Shift>}');
    await user.click(row('b').getByTitle('項目を選択／ドラッグして移動'));
    await user.keyboard('{/Shift}');
    expect(screen.getByText('2 項目を選択')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '完了' }));
    expect(await saved()).toBe('- [x] a\n- [x] b\n- [ ] c\n');
  });
});

describe('Markdown links in titles', () => {
  it('shows http and https links as anchors and keeps other links as text', async () => {
    const { row } = await setup({
      'tasks.md': '- [ ] see [docs](https://example.com/docs) and [old](http://example.org) not [bad](javascript:alert(1)) or [file](ftp://example.net)\n',
    });
    const item = row('see [docs](https://example.com/docs) and [old](http://example.org) not [bad](javascript:alert(1)) or [file](ftp://example.net)');
    const links = item.getAllByRole('link');
    expect(links.map(link => [link.textContent, link.getAttribute('href')])).toEqual([
      ['docs', 'https://example.com/docs'],
      ['old', 'http://example.org'],
    ]);
    for (const link of links) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
    }
    const display = links[0].closest('.title-display');
    expect(display.textContent).toBe('see docs and old not [bad](javascript:alert(1)) or [file](ftp://example.net)');
  });

  it('keeps the raw Markdown in the editable title', async () => {
    const { user, title, saved } = await setup({ 'tasks.md': '- [ ] [docs](https://example.com)\n' });
    const node = title('[docs](https://example.com)');
    await user.type(node, ' now');
    expect(await saved()).toBe('- [ ] [docs](https://example.com) now\n');
  });

  it('clicking the text outside a link starts editing the title', async () => {
    const { user, container, title } = await setup({ 'tasks.md': '- [ ] read [docs](https://example.com)\n' });
    const display = container.querySelector('.title-display');
    await user.click(display.firstChild.parentElement);
    expect(document.activeElement).toBe(title('read [docs](https://example.com)'));
    expect(display.closest('.title-area').classList.contains('is-editing')).toBe(true);
  });

  it('renders emphasis, code and bare URLs in titles', async () => {
    const { container } = await setup({ 'tasks.md': '- [ ] **bold** *em* `code` ~~gone~~ https://example.com\n' });
    const display = container.querySelector('.title-display');
    expect(display.querySelector('strong').textContent).toBe('bold');
    expect(display.querySelector('em').textContent).toBe('em');
    expect(display.querySelector('code').textContent).toBe('code');
    expect(display.querySelector('del').textContent).toBe('gone');
    expect(display.querySelector('a').getAttribute('href')).toBe('https://example.com');
  });
});

describe('inline Markdown in notes', () => {
  const note = '  see [docs](https://example.com/docs) or https://example.org.\n  **bold** _em_ `code` ~~gone~~\n';
  const noteDisplay = container => container.querySelector('.note-display');

  it('renders each syntax and keeps the line breaks', async () => {
    const { container } = await setup({ 'tasks.md': '- [ ] a\n' + note });
    const display = noteDisplay(container);
    expect(display.textContent).toBe('see docs or https://example.org.\nbold em code gone');
    expect([...display.querySelectorAll('a')].map(link => [link.textContent, link.getAttribute('href'), link.target, link.rel])).toEqual([
      ['docs', 'https://example.com/docs', '_blank', 'noopener noreferrer'],
      ['https://example.org', 'https://example.org', '_blank', 'noopener noreferrer'],
    ]);
    expect(['strong', 'em', 'code', 'del'].map(tag => display.querySelector(tag).textContent)).toEqual(['bold', 'em', 'code', 'gone']);
  });

  it('shows the raw text while the note is edited', async () => {
    const { user, screen, container, saved } = await setup({ 'tasks.md': '- [ ] a\n  **bold**\n' });
    const area = container.querySelector('.note-area');
    await user.click(noteDisplay(container).querySelector('strong'));
    const field = screen.getByRole('textbox', { name: '項目のノート' });
    expect(document.activeElement).toBe(field);
    expect(area.classList.contains('is-editing')).toBe(true);
    expect(field.value).toBe('**bold**');
    // Without caretPositionFromPoint (jsdom), the caret goes to the end.
    expect([field.selectionStart, field.selectionEnd]).toEqual([8, 8]);
    await user.keyboard(' and *more*');
    field.blur();
    await flush();
    expect(area.classList.contains('is-editing')).toBe(false);
    expect(noteDisplay(container).querySelector('em').textContent).toBe('more');
    expect(await saved()).toBe('- [ ] a\n  **bold** and *more*\n');
  });

  it('clicking a link opens it instead of editing the note', async () => {
    const { user, container } = await setup({ 'tasks.md': '- [ ] a\n  [docs](https://example.com)\n' });
    const link = noteDisplay(container).querySelector('a');
    const opened = [];
    link.addEventListener('click', event => { opened.push(link.href); event.preventDefault(); });
    await user.click(link);
    expect(opened).toEqual(['https://example.com/']);
    expect(document.activeElement).toBe(link);
    expect(container.querySelector('.note-area').classList.contains('is-editing')).toBe(false);
  });

  it('keeps other link targets and HTML as plain text', async () => {
    const { container } = await setup({ 'tasks.md': '- [ ] a\n  [bad](javascript:alert(1)) <img src=x onerror=alert(1)> `<b>`\n' });
    const display = noteDisplay(container);
    expect(display.querySelector('a, img, b')).toBeNull();
    expect(display.textContent).toBe('[bad](javascript:alert(1)) <img src=x onerror=alert(1)> <b>');
  });

  it('a plain note stays a plain textarea', async () => {
    const { container } = await setup({ 'tasks.md': '- [ ] a\n  just a note\n' });
    expect(noteDisplay(container)).toBeNull();
    expect(container.querySelector('.note-area').classList.contains('has-markup')).toBe(false);
  });
});

describe('filtering', () => {
  const text = '- [ ] parent\n  - [x] finished child\n  - [ ] open child #work\n- [/] doing #home\n- [x] done top\n';

  it('filters by status and keeps ancestors of matching items', async () => {
    const { user, screen, titleValues } = await setup({ 'tasks.md': text });
    const select = screen.getByRole('combobox', { name: '表示する状態' });
    await user.selectOptions(select, 'done');
    expect(titleValues()).toEqual(['parent', 'finished child', 'done top']);
    await user.selectOptions(screen.getByRole('combobox', { name: '表示する状態' }), 'not-done');
    expect(titleValues()).toEqual(['parent', 'open child #work', 'doing #home']);
  });

  it('filters by words and #tags from the search box on Enter', async () => {
    const { user, screen, titleValues } = await setup({ 'tasks.md': text });
    await user.type(screen.getByRole('searchbox', { name: '語句・タグで絞り込み' }), '#work{Enter}');
    expect(titleValues()).toEqual(['parent', 'open child #work']);
    const search = screen.getByRole('searchbox', { name: '語句・タグで絞り込み' });
    await user.clear(search);
    await user.type(search, 'DONE{Enter}');
    expect(titleValues()).toEqual(['done top']);
  });

  it('reset shows everything again', async () => {
    const { user, screen, titleValues } = await setup({ 'tasks.md': text });
    await user.type(screen.getByRole('searchbox', { name: '語句・タグで絞り込み' }), 'nothing-matches{Enter}');
    expect(titleValues()).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'リセット' }));
    expect(titleValues()).toEqual(['parent', 'finished child', 'open child #work', 'doing #home', 'done top']);
  });

  it('a task added while filtered gets the filtered status and tags and stays visible', async () => {
    const { user, screen, titles, saved } = await setup({ 'tasks.md': text });
    await user.selectOptions(screen.getByRole('combobox', { name: '表示する状態' }), 'in-progress');
    await user.type(screen.getByRole('searchbox', { name: '語句・タグで絞り込み' }), '#home{Enter}');
    await user.click(screen.getByRole('button', { name: 'リストの末尾に項目を追加' }));
    expect(titles().map(node => node.value)).toEqual(['doing #home', '#home']);
    expect(document.activeElement).toBe(titles()[1]);
    expect(await saved()).toBe(text + '- [/] #home\n');
  });
});

describe('outline view', () => {
  it('collapsing an item hides its children', async () => {
    const { user, row, titleValues } = await setup({ 'tasks.md': '- [ ] a\n  - [ ] child\n- [ ] b\n' });
    await user.click(row('a').getByTitle('子項目を折りたたむ／開く'));
    expect(titleValues()).toEqual(['a', 'b']);
    await user.click(row('a').getByTitle('子項目を折りたたむ／開く'));
    expect(titleValues()).toEqual(['a', 'child', 'b']);
  });

  it('zooming into an item shows it as a heading with only its children', async () => {
    const { user, screen, row, titleValues } = await setup({ 'tasks.md': '- [ ] a\n  - [ ] child\n- [ ] b\n' });
    await user.click(row('a').getByTitle('この項目にズーム'));
    expect(screen.getByRole('textbox', { name: 'ズーム対象のタイトル' }).value).toBe('a');
    expect(titleValues()).toEqual(['child']);
    await user.click(screen.getByRole('button', { name: '← 全体に戻る' }));
    expect(titleValues()).toEqual(['a', 'child', 'b']);
  });

  it('adds a bookmark for the current file', async () => {
    const stored = [];
    const { user, screen } = await setup({ 'tasks.md': '- [ ] a\n' }, { savePreferences: async value => { stored.push(value); } });
    await user.click(screen.getByRole('button', { name: 'ファイルを追加' }));
    expect(screen.getByRole('button', { name: 'tasks.md' })).toBeTruthy();
    await flush();
    expect(stored.at(-1).bookmarks).toMatchObject([{ kind: 'file', file: 'tasks.md', status: 'all', tags: [] }]);
  });

  // Drag and drop needs layout and DataTransfer, which jsdom lacks; it is tested in e2e/drag.spec.ts.
});
