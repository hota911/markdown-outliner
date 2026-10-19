import { describe, expect, it } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/dom';
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

  it('a bullet is filtered by the status of its nearest task', async () => {
    const bullets = '- [x] done task\n  - done note\n    - deeper note\n- [ ] open task\n  - open note\n- loose bullet\n';
    const { user, screen, titleValues } = await setup({ 'tasks.md': bullets });
    await user.selectOptions(screen.getByRole('combobox', { name: '表示する状態' }), 'not-done');
    expect(titleValues()).toEqual(['open task', 'open note', 'loose bullet']);
    await user.selectOptions(screen.getByRole('combobox', { name: '表示する状態' }), 'done');
    expect(titleValues()).toEqual(['done task', 'done note', 'deeper note']);
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

  it('Cmd/Ctrl+F moves the focus to the search box with its text selected', async () => {
    const { user, screen, row, titleValues } = await setup({ 'tasks.md': text });
    const search = screen.getByRole('searchbox', { name: '語句・タグで絞り込み' });
    await user.type(search, '#work{Enter}');
    await user.click(row('open child #work').getByRole('textbox', { name: '項目の内容' }));
    await user.keyboard('{Control>}f{/Control}');
    expect(document.activeElement).toBe(search);
    expect([search.selectionStart, search.selectionEnd]).toEqual([0, '#work'.length]);
    await user.keyboard('{Meta>}f{/Meta}');
    expect(document.activeElement).toBe(search);
    expect(titleValues()).toEqual(['parent', 'open child #work']);
  });

  it('filters as the search box is typed in, keeping the text as typed', async () => {
    const { user, screen, titleValues } = await setup({ 'tasks.md': text });
    const search = screen.getByRole('searchbox', { name: '語句・タグで絞り込み' });
    await user.type(search, '#work op');
    expect(titleValues()).toEqual(['parent', 'open child #work']);
    expect(search.value).toBe('#work op');
    await user.clear(search);
    expect(titleValues()).toEqual(['parent', 'finished child', 'open child #work', 'doing #home', 'done top']);
    await user.type(search, 'do ');
    expect(titleValues()).toEqual(['doing #home', 'done top']);
    expect(search.value).toBe('do ');
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

// The fold button of the item whose title field is `title`, for items that share a title.
const fold = title => within(title.closest('.outline-item')).getByTitle('子項目を折りたたむ／開く');

describe('outline view', () => {
  it('collapsing an item hides its children', async () => {
    const { user, row, titleValues } = await setup({ 'tasks.md': '- [ ] a\n  - [ ] child\n- [ ] b\n' });
    await user.click(row('a').getByTitle('子項目を折りたたむ／開く'));
    expect(titleValues()).toEqual(['a', 'b']);
    await user.click(row('a').getByTitle('子項目を折りたたむ／開く'));
    expect(titleValues()).toEqual(['a', 'child', 'b']);
  });

  // Regression: folds used to be restored after an edit by matching titles, so every item with
  // the same title as a folded one was folded too.
  it('an edit keeps only the folded item folded when another item has the same title', async () => {
    const { user, titles, row, titleValues } = await setup({ 'tasks.md': '- [ ] a\n  - [ ] c1\n- [ ] a\n  - [ ] c2\n- [ ] b\n' });
    await user.click(fold(titles()[0]));
    expect(titleValues()).toEqual(['a', 'a', 'c2', 'b']);
    await user.click(row('b').getByRole('button', { name: '未着手（クリックで進行中）' }));
    expect(titleValues()).toEqual(['a', 'a', 'c2', 'b']);
  });

  // Regression: folds were kept by line number, so lines inserted above moved the fold.
  it('a folded item stays folded when an external change inserts lines above it', async () => {
    const { user, row, titleValues, adapter } = await setup({ 'tasks.md': '- [ ] x\n- [ ] a\n  - [ ] child a\n- [ ] b\n  - [ ] child b\n' });
    await user.click(row('a').getByTitle('子項目を折りたたむ／開く'));
    expect(titleValues()).toEqual(['x', 'a', 'b', 'child b']);
    adapter.externalWrite('tasks.md', '- [ ] new 1\n- [ ] new 2\n- [ ] x\n- [ ] a\n  - [ ] child a\n- [ ] b\n  - [ ] child b\n');
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(titleValues()).toEqual(['new 1', 'new 2', 'x', 'a', 'b', 'child b']));
  });

  it('Alt+ArrowUp keeps the moved item folded, and only it', async () => {
    const { user, titles, titleValues } = await setup({ 'tasks.md': '- [ ] a\n  - [ ] c1\n- [ ] b\n- [ ] a\n  - [ ] c2\n' });
    await user.click(fold(titles()[3]));
    expect(titleValues()).toEqual(['a', 'c1', 'b', 'a']);
    await user.click(titles()[3]);
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(titleValues()).toEqual(['a', 'c1', 'a', 'b']);
  });

  it('Tab keeps the indented item folded, and only it', async () => {
    const { user, titles, titleValues } = await setup({ 'tasks.md': '- [ ] a\n  - [ ] c1\n- [ ] b\n- [ ] a\n  - [ ] c2\n' });
    await user.click(fold(titles()[3]));
    await user.click(titles()[3]);
    await user.keyboard('{Tab}');
    expect(titleValues()).toEqual(['a', 'c1', 'b', 'a']);
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

describe('starting a pomodoro', () => {
  const label = 'Pomodoro Timer プラグインでこのタスクのポモドーロを開始（試験機能）';

  it('has no button when the host has no timer', async () => {
    const { row } = await setup({ 'tasks.md': '- [ ] a\n' });
    expect(row('a').queryByTitle(label)).toBeNull();
  });

  it('gives the task a block id, saves it, then hands the task to the host', async () => {
    const calls = [];
    const { user, row, adapter } = await setup({ 'tasks.md': '- [ ] write [🍅:: 1/3]\n- bullet\n' }, {
      startPomodoro: async task => { calls.push({ ...task, text: adapter.files.get('tasks.md') }); },
    });
    expect(row('bullet').queryByTitle(label)).toBeNull();
    await user.click(row('write [🍅:: 1/3]').getByTitle(label));
    await waitFor(() => expect(calls).toHaveLength(1));
    const [{ blockId, ...call }] = calls;
    expect(blockId).toMatch(/^[a-z0-9]+$/);
    expect(call).toEqual({ path: 'tasks.md', line: 0, title: `write [🍅:: 1/3] ^${blockId}`, text: `- [ ] write [🍅:: 1/3] ^${blockId}\n- bullet\n` });
  });

  it('keeps a block id the task already has', async () => {
    const calls = [];
    const { user, row, adapter } = await setup({ 'tasks.md': '- [ ] a ^ab12\n' }, { startPomodoro: async task => { calls.push(task); } });
    await user.click(row('a ^ab12').getByTitle(label));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].blockId).toBe('ab12');
    expect(adapter.saves).toEqual([]);
  });

  it('shows why the host could not start it', async () => {
    const { user, row, screen } = await setup({ 'tasks.md': '- [ ] a ^ab12\n' }, { startPomodoro: async () => { throw new Error('止まっています'); } });
    await user.click(row('a ^ab12').getByTitle(label));
    expect(await screen.findByText('ポモドーロを開始できません：止まっています')).toBeTruthy();
  });
});

describe('Tasks and pomodoro fields', () => {
  const text = '- [ ] parent\n  - [ ] a [🍅:: 1/3] 🔁 every day ^ab12\n  - [x] b [🍅:: 2]\n- [ ] c [🍅:: 0/2]\n';

  it('shows the fields as badges and keeps the source in the editable title', async () => {
    const { title } = await setup({ 'tasks.md': text });
    const badges = [...title('a [🍅:: 1/3] 🔁 every day ^ab12').closest('.outline-item').querySelectorAll('.title-display .meta')];
    expect(badges.map(node => [node.dataset.meta, node.textContent])).toEqual([['pomodoro', '🍅 1/3'], ['recurrence', '🔁 every day'], ['block', '^ab12']]);
    expect(badges[0].title).toBe('[🍅:: 1/3]');
    expect(title('a [🍅:: 1/3] 🔁 every day ^ab12')).toBeTruthy();
  });

  it('clicking a badge edits the title with the caret after its field', async () => {
    const { user, title } = await setup({ 'tasks.md': text });
    await user.click(title('c [🍅:: 0/2]').closest('.outline-item').querySelector('.meta'));
    const field = title('c [🍅:: 0/2]');
    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe('c [🍅:: 0/2]'.length);
  });

  it('sums the counts under a parent and of the items shown', async () => {
    const { user, container, row, screen } = await setup({ 'tasks.md': text });
    expect(row('parent').getByTitle('この項目の下にある項目のポモドーロ（実績/見積もり）').textContent).toBe('Σ 🍅 3/3');
    expect(row('c [🍅:: 0/2]').queryByTitle('この項目の下にある項目のポモドーロ（実績/見積もり）')).toBeNull();
    const total = () => container.querySelector('.estimate-total')?.textContent;
    expect(total()).toBe('🍅 3/5');
    await user.selectOptions(screen.getByRole('combobox', { name: '表示する状態' }), 'not-done');
    expect(total()).toBe('🍅 1/5');
  });

  it('shows no total without any pomodoro field', async () => {
    const { container } = await setup({ 'tasks.md': '- [ ] a\n' });
    expect(container.querySelector('.estimate-total')).toBeNull();
  });
});

describe('one-line notes', () => {
  it('shows the first line of each note until it is edited, and remembers the choice', async () => {
    const stored = [];
    const { user, screen, container } = await setup({ 'tasks.md': '- [ ] A\n  first **line**\n  second\n- [ ] B\n  only\n' }, { savePreferences: async value => { stored.push(value); } });
    await user.click(screen.getByRole('checkbox', { name: 'ノートを1行で表示' }));
    const displays = () => [...container.querySelectorAll('.note-display')].map(node => node.textContent);
    expect(displays()).toEqual(['first line…', 'only']);
    await waitFor(() => expect(stored.at(-1)?.oneLineNotes).toBe(true));
    const note = screen.getAllByRole('textbox', { name: '項目のノート' })[0];
    note.focus();
    await waitFor(() => expect(note.closest('.note-area').classList.contains('is-editing')).toBe(true));
    expect(note.value).toBe('first **line**\nsecond');
    await user.click(screen.getByRole('checkbox', { name: 'ノートを1行で表示' }));
    expect(displays()).toEqual(['first line\nsecond']);
  });

  it('starts with one-line notes when the preference was saved', async () => {
    const { screen, container } = await setup({ 'tasks.md': '- [ ] A\n  first\n  second\n' }, { preferences: { bookmarks: [], oneLineNotes: true } });
    expect(screen.getByRole('checkbox', { name: 'ノートを1行で表示' }).checked).toBe(true);
    expect(container.querySelector('.note-display').textContent).toBe('first…');
  });
});

describe('items hidden under a match', () => {
  const text = '- [/] a\n  - [ ] todo\n  - [x] done\n    - [ ] deep\n  - [/] doing\n- [ ] b\n  - [x] c\n';
  const inProgress = (user, screen) => user.selectOptions(screen.getByRole('combobox', { name: '表示する状態' }), 'in-progress');
  const dimmedValues = titles => titles().filter(node => node.closest('.outline-item').classList.contains('is-context')).map(node => node.value);

  it('shows, dimmed, everything under one match from its "N more" button, and hides it again', async () => {
    const { user, screen, titles, titleValues, title } = await setup({ 'tasks.md': text });
    await inProgress(user, screen);
    expect(titleValues()).toEqual(['a', 'doing']);
    const more = screen.getByRole('button', { name: '「a」の下で絞り込みにより隠れている 3 件を表示' });
    expect(more.textContent).toBe('ほか 3 件');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByRole('button', { name: /件を表示$/ })).toHaveLength(1);
    await user.click(more);
    expect(titleValues()).toEqual(['a', 'todo', 'done', 'deep', 'doing']);
    expect(dimmedValues(titles)).toEqual(['todo', 'done', 'deep']);
    expect(document.getElementById(title('todo').getAttribute('aria-describedby')).textContent).toBe('上の項目が絞り込みに一致するため表示');
    const hide = screen.getByRole('button', { name: '「a」の下で絞り込みに一致しない 3 件を隠す' });
    expect(hide.textContent).toBe('隠す');
    expect(hide.getAttribute('aria-expanded')).toBe('true');
    await user.click(hide);
    expect(titleValues()).toEqual(['a', 'doing']);
  });

  it('works from the keyboard', async () => {
    const { user, screen, titleValues } = await setup({ 'tasks.md': text });
    await inProgress(user, screen);
    screen.getByRole('button', { name: /3 件を表示$/ }).focus();
    await user.keyboard('{Enter}');
    expect(titleValues()).toEqual(['a', 'todo', 'done', 'deep', 'doing']);
    expect(document.activeElement.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard(' ');
    expect(titleValues()).toEqual(['a', 'doing']);
  });

  it('expands only that item, and a match inside it gets no button', async () => {
    const { user, screen, titleValues } = await setup({ 'tasks.md': '- [/] a\n  - [/] b\n    - [ ] c\n  - [ ] d\n- [/] e\n  - [ ] f\n' });
    await inProgress(user, screen);
    expect(titleValues()).toEqual(['a', 'b', 'e']);
    const buttons = () => screen.queryAllByRole('button', { name: /件を(表示|隠す)$/ }).map(node => node.getAttribute('aria-label'));
    expect(buttons()).toEqual(['「a」の下で絞り込みにより隠れている 2 件を表示', '「b」の下で絞り込みにより隠れている 1 件を表示', '「e」の下で絞り込みにより隠れている 1 件を表示']);
    await user.click(screen.getByRole('button', { name: /「a」.*2 件を表示$/ }));
    expect(titleValues()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(buttons()).toEqual(['「a」の下で絞り込みに一致しない 2 件を隠す', '「e」の下で絞り込みにより隠れている 1 件を表示']);
  });

  it('forgets the expanded items when the filter or the file changes', async () => {
    const { user, screen, titleValues } = await setup({ 'tasks.md': text, 'other.md': '- [/] x\n  - [ ] y\n' });
    await inProgress(user, screen);
    await user.click(screen.getByRole('button', { name: /3 件を表示$/ }));
    expect(titleValues()).toHaveLength(5);
    await user.selectOptions(screen.getByRole('combobox', { name: '表示する状態' }), 'not-done');
    await inProgress(user, screen);
    expect(titleValues()).toEqual(['a', 'doing']);
    await user.click(screen.getByRole('button', { name: /3 件を表示$/ }));
    const files = screen.getByRole('combobox', { name: '開くファイル' });
    await user.selectOptions(files, 'other.md');
    await waitFor(() => expect(titleValues()).toEqual(['x']));
    await user.selectOptions(files, 'tasks.md');
    await waitFor(() => expect(titleValues()).toEqual(['a', 'doing']));
  });

  it('shows no button without a filter', async () => {
    const { titleValues, screen, titles } = await setup({ 'tasks.md': text });
    expect(titleValues()).toHaveLength(7);
    expect(screen.queryByRole('button', { name: /件を表示$/ })).toBeNull();
    expect(dimmedValues(titles)).toEqual([]);
  });
});
