import { describe, expect, it } from 'vitest';
import { fireEvent, within } from '@testing-library/dom';
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
    expect(container.querySelector('.note-area').classList.contains('has-overlay')).toBe(false);
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

  it('status options show the same icon as the items with that status and are named without it', async () => {
    const { screen, container } = await setup({ 'tasks.md': text });
    const select = screen.getByRole('combobox', { name: '表示する状態' });
    const iconOf = status => container.querySelector(`.task-status[data-status="${status}"]`).textContent;
    const shown = ['すべて', '◌ 完了以外', `${iconOf('todo')} 未着手`, `${iconOf('in-progress')} 進行中`, `${iconOf('done')} 完了`];
    expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual(shown);
    for (const name of ['すべて', '完了以外', '未着手', '進行中', '完了']) {
      expect(within(select).getByRole('option', { name })).toBeTruthy();
    }
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

  const contextNote = '配下の項目が絞り込みに一致するため表示';
  const contextTitles = screen => screen.queryAllByRole('textbox', { name: '項目の内容', description: contextNote }).map(node => node.value);
  const depth = node => node.closest('.outline-item').style.getPropertyValue('--depth');

  it('shows a non-matching parent of a match as dimmed context, keeping the child under it', async () => {
    const { user, screen, titleValues, title } = await setup({ 'tasks.md': '- [ ] A\n- [x] B\n  - [ ] C\n' });
    await user.selectOptions(screen.getByRole('combobox', { name: '表示する状態' }), 'todo');
    expect(titleValues()).toEqual(['A', 'B', 'C']);
    expect(contextTitles(screen)).toEqual(['B']);
    expect([depth(title('B')), depth(title('C'))]).toEqual(['0', '1']);
    expect(title('B').closest('.outline-item').classList.contains('is-context')).toBe(true);
    expect(title('C').closest('.outline-item').classList.contains('is-context')).toBe(false);
  });

  it('keeps ancestors of text matches as context and hides non-matching siblings', async () => {
    const { user, screen, titleValues } = await setup({ 'tasks.md': text });
    await user.type(screen.getByRole('searchbox', { name: '語句・タグで絞り込み' }), '#work{Enter}');
    expect(titleValues()).toEqual(['parent', 'open child #work']);
    expect(contextTitles(screen)).toEqual(['parent']);
  });

  it('shows no context when nothing is filtered', async () => {
    const { screen, titleValues } = await setup({ 'tasks.md': text });
    expect(titleValues()).toHaveLength(5);
    expect(contextTitles(screen)).toEqual([]);
  });

  it('shows an embed only when something in the embedded file matches, with its ancestors as context', async () => {
    const { user, screen, titleValues } = await setup({
      'tasks.md': '- [x] host\n  - ![[work.md]]\n  - ![[home.md]]\n- [ ] other\n',
      'work.md': '- [x] project\n  - [ ] step\n',
      'home.md': '- [x] chores\n',
    });
    await user.selectOptions(screen.getByRole('combobox', { name: '表示する状態' }), 'todo');
    expect(titleValues()).toEqual(['host', 'project', 'step', 'other']);
    expect(contextTitles(screen)).toEqual(['host', 'project']);
    expect(screen.getByText('work.md', { selector: '.embed-title' })).toBeTruthy();
    expect(screen.queryByText('home.md', { selector: '.embed-title' })).toBeNull();
  });

  it('shows #tags like links; clicking one filters by it once, clicking other text edits', async () => {
    const { user, screen, title, titleValues } = await setup({ 'tasks.md': text });
    const display = title('open child #work').closest('.title-area').querySelector('.title-display');
    const tag = within(display).getByText('#work');
    expect(tag.classList.contains('tag')).toBe(true);

    await user.click(tag);
    expect(screen.getByRole('searchbox', { name: '語句・タグで絞り込み' }).value).toBe('#work');
    expect(titleValues()).toEqual(['parent', 'open child #work']);
    await user.click(within(title('open child #work').closest('.title-area')).getByText('#work'));
    expect(screen.getByRole('searchbox', { name: '語句・タグで絞り込み' }).value).toBe('#work');

    await user.click(within(title('open child #work').closest('.title-area')).getByText('open child'));
    expect(document.activeElement).toBe(title('open child #work'));
    expect(screen.getByRole('searchbox', { name: '語句・タグで絞り込み' }).value).toBe('#work');
  });

  // While a title is edited the textarea is on top, so ⌘/Ctrl-click finds the tag at the caret.
  // jsdom does not place the caret from the pointer, so the tests put it where the click lands.
  async function clickAt(node, offset, modifiers) {
    node.focus();
    node.setSelectionRange(offset, offset);
    fireEvent.click(node, modifiers);
    await flush();
  }

  it('⌘/Ctrl-click on a #tag adds it to the search once and filters right away', async () => {
    const { user, screen, title, titleValues } = await setup({ 'tasks.md': text });
    const search = () => screen.getByRole('searchbox', { name: '語句・タグで絞り込み' });
    await user.type(search(), 'child{Enter}');
    expect(titleValues()).toEqual(['parent', 'finished child', 'open child #work']);

    await clickAt(title('open child #work'), 'open child #wo'.length, { metaKey: true });
    expect(search().value).toBe('child #work');
    expect(titleValues()).toEqual(['parent', 'open child #work']);

    await clickAt(title('open child #work'), 'open child '.length, { ctrlKey: true });
    expect(search().value).toBe('child #work');
    expect(titleValues()).toEqual(['parent', 'open child #work']);
  });

  it('a plain click on a #tag, or ⌘-click on another word, only edits', async () => {
    const { screen, title, titleValues } = await setup({ 'tasks.md': text });
    await clickAt(title('doing #home'), 'doing #ho'.length, {});
    await clickAt(title('doing #home'), 'do'.length, { metaKey: true });
    expect(screen.getByRole('searchbox', { name: '語句・タグで絞り込み' }).value).toBe('');
    expect(titleValues()).toEqual(['parent', 'finished child', 'open child #work', 'doing #home', 'done top']);
    expect(document.activeElement).toBe(title('doing #home'));
  });

  it('a #tag inside bold text or in a note is shown like a link and filters on a click', async () => {
    const { user, screen, title, titleValues } = await setup({ 'tasks.md': '- [ ] **fix #bug now** and **#plain**\n- [ ] other\n  see #home\n- [ ] doing #home\n' });
    const search = () => screen.getByRole('searchbox', { name: '語句・タグで絞り込み' });
    const display = title('**fix #bug now** and **#plain**').closest('.title-area').querySelector('.title-display');
    const tag = within(display).getByText('#bug');
    expect(tag.classList.contains('tag')).toBe(true);
    expect(tag.closest('strong')).toBeTruthy();
    // `**#plain**` is not a whole-word tag, so it stays bold text.
    expect(within(display).getByText('#plain').classList.contains('tag')).toBe(false);
    await user.click(tag);
    expect(search().value).toBe('#bug');
    expect(titleValues()).toEqual(['**fix #bug now** and **#plain**']);

    await user.click(screen.getByRole('button', { name: 'リセット' }));
    const noteTag = within(title('other').closest('.outline-item').querySelector('.note-display')).getByText('#home');
    expect(noteTag.dataset.tag).toBe('home');
    await user.click(noteTag);
    expect(search().value).toBe('#home');
    expect(titleValues()).toEqual(['other', 'doing #home']);

    await user.click(screen.getByRole('button', { name: 'リセット' }));
    await clickAt(screen.getByRole('textbox', { name: '項目のノート' }), 'see #ho'.length, { metaKey: true });
    expect(search().value).toBe('#home');
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

describe('highlighting filter matches', () => {
  const marks = row => row.queryAllByText((_, node) => node.tagName === 'MARK').map(node => node.textContent);
  const search = async (user, screen, value) => user.type(screen.getByRole('searchbox', { name: '語句・タグで絞り込み' }), value + '{Enter}');

  it('marks the matched words, ignoring case, and the matched #tags in titles', async () => {
    const { user, screen, row, title } = await setup({ 'tasks.md': '- [ ] #workshop plan\n  - [ ] Plan the plan #work\n' });
    await search(user, screen, 'PLAN #work');
    expect(marks(row('Plan the plan #work'))).toEqual(['Plan', 'plan', '#work']);
    // `#workshop` is another tag, so the parent is shown only as context and has no marks.
    expect(marks(row('#workshop plan'))).toEqual([]);
    expect(title('Plan the plan #work').closest('.title-area').querySelector('.title-display').textContent).toBe('Plan the plan #work');
  });

  it('marks matches inside link text and keeps the link', async () => {
    const { user, screen, row } = await setup({ 'tasks.md': '- [ ] read [the docs](https://example.com) docs\n' });
    await search(user, screen, 'docs');
    const item = row('read [the docs](https://example.com) docs');
    expect(marks(item)).toEqual(['docs', 'docs']);
    expect(item.getByRole('link').textContent).toBe('the docs');
  });

  it('marks matches inside bold text, link text and a #tag inside bold text', async () => {
    const { user, screen, row } = await setup({ 'tasks.md': '- [ ] **plan #work now** [plan docs](https://example.com) `plan`\n' });
    await search(user, screen, 'plan #work');
    const item = row('**plan #work now** [plan docs](https://example.com) `plan`');
    expect(marks(item)).toEqual(['plan', '#work', 'plan', 'plan']);
    const [bold, tag, link, code] = item.queryAllByText((_, node) => node.tagName === 'MARK');
    expect(bold.parentElement.tagName).toBe('STRONG');
    expect(tag.parentElement.dataset.tag).toBe('work');
    expect(tag.closest('strong')).toBeTruthy();
    expect(link.closest('a').getAttribute('href')).toBe('https://example.com');
    expect(code.parentElement.tagName).toBe('CODE');
  });

  // jsdom has no caretPositionFromPoint, so the test gives the display one that reports `node` and `offset`.
  async function clickAtText(user, node, offset) {
    const original = document.caretPositionFromPoint;
    document.caretPositionFromPoint = () => ({ offsetNode: node, offset });
    try { await user.click(node.parentElement); }
    finally { document.caretPositionFromPoint = original; }
  }

  it('a click on highlighted text puts the caret at the clicked character, and past the closing markers at the end', async () => {
    const { user, screen, title } = await setup({ 'tasks.md': '- [ ] buy **fresh milk**\n' });
    await search(user, screen, 'milk');
    const field = title('buy **fresh milk**');
    const mark = () => field.closest('.title-area').querySelector('.title-display mark');
    expect(mark().closest('strong')).toBeTruthy();
    await clickAtText(user, mark().firstChild, 2);
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual(['buy **fresh mi'.length, 'buy **fresh mi'.length]);

    field.blur();
    await flush();
    // The end of the last text of the title is after `**`.
    await clickAtText(user, mark().firstChild, 'milk'.length);
    expect([field.selectionStart, field.selectionEnd]).toEqual(['buy **fresh milk**'.length, 'buy **fresh milk**'.length]);
  });

  it('marks nothing without a text filter', async () => {
    const { user, screen, container, title } = await setup({ 'tasks.md': '- [ ] a #work\n- [ ] plain\n- [x] b\n' });
    await user.selectOptions(screen.getByRole('combobox', { name: '表示する状態' }), 'todo');
    expect(container.querySelector('mark')).toBeNull();
    // A title without links, tags or marks has no rendered overlay.
    expect(title('plain').closest('.title-area').querySelector('.title-display')).toBeNull();
  });

  it('marks a matched #tag inside its tag link, which still filters by it once on a click', async () => {
    const { user, screen, row, title, titleValues } = await setup({ 'tasks.md': '- [ ] parent\n  - [ ] open child #work\n- [ ] other #work\n' });
    await search(user, screen, 'open #work');
    expect(titleValues()).toEqual(['parent', 'open child #work']);
    expect(marks(row('open child #work'))).toEqual(['open', '#work']);
    const tag = title('open child #work').closest('.title-area').querySelector('.title-display .tag');
    expect(tag.dataset.tag).toBe('work');
    expect(tag.querySelector('mark').textContent).toBe('#work');

    await user.click(tag.querySelector('mark'));
    expect(screen.getByRole('searchbox', { name: '語句・タグで絞り込み' }).value).toBe('open #work');
    expect(document.activeElement).not.toBe(title('open child #work'));
  });

  it('a highlighted title can still be edited', async () => {
    const { user, screen, container, title, saved } = await setup({ 'tasks.md': '- [ ] buy milk\n' });
    await search(user, screen, 'milk');
    await user.click(container.querySelector('mark'));
    expect(document.activeElement).toBe(title('buy milk'));
    await user.keyboard(' today');
    expect(await saved()).toBe('- [ ] buy milk today\n');
    expect(marks(screen)).toEqual(['milk']);
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

  // Drag and drop needs layout and DataTransfer, which jsdom lacks; it is tested in e2e/drag.spec.ts.
});
