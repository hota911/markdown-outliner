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
    expect(screen.getByText('ファイル: work.md')).toBeTruthy();
    expect(screen.queryByText('ファイル: home.md')).toBeNull();
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

  it('marks nothing without a text filter', async () => {
    const { user, screen, container } = await setup({ 'tasks.md': '- [ ] a #work\n- [x] b\n' });
    await user.selectOptions(screen.getByRole('combobox', { name: '表示する状態' }), 'todo');
    expect(container.querySelector('mark')).toBeNull();
    expect(container.querySelector('.title-display')).toBeNull();
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
