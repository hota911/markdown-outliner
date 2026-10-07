import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/dom';
import { flush, setup } from './harness.js';

const files = {
  'tasks.md': '- [ ] a #work\n  - [/] child #work\n  - [ ] other\n- [ ] b\n',
  'other.md': '- [ ] x\n',
};

async function setupWithStore(preferences = { bookmarks: [] }) {
  const stored = [];
  const outliner = await setup(files, { preferences, savePreferences: async value => { stored.push(value); } });
  const { screen, user } = outliner;
  return {
    ...outliner,
    stored,
    status: () => screen.getByRole('combobox', { name: '表示する状態' }),
    search: () => screen.getByRole('searchbox', { name: '語句・タグで絞り込み' }),
    zoomTitle: () => screen.queryByRole('textbox', { name: 'ズーム対象のタイトル' }),
    addView: () => user.click(screen.getByRole('button', { name: '今の表示を追加' })),
    // Shows other.md without filters, so that opening a bookmark has everything to restore.
    async leave() {
      await user.selectOptions(screen.getByRole('combobox', { name: '開くファイル' }), 'other.md');
      await user.click(screen.getByRole('button', { name: 'リセット' }));
      expect(outliner.titleValues()).toEqual(['x']);
    },
  };
}

describe('bookmarks', () => {
  it('adds the current view with its file, status, tags, words and zoom, and restores all of them', async () => {
    const outliner = await setupWithStore();
    const { user, screen, row, titleValues, stored, status, search, zoomTitle, addView, leave } = outliner;
    await user.selectOptions(status(), 'in-progress');
    await user.type(search(), '#work child{Enter}');
    await user.click(row('a #work').getByTitle('この項目にズーム'));
    expect(titleValues()).toEqual(['child #work']);

    await addView();
    await flush();
    expect(stored.at(-1).bookmarks).toMatchObject([{
      kind: 'view', file: 'tasks.md', status: 'in-progress', tags: ['work'], searchText: 'child',
      zoom: { path: 'tasks.md', line: 0, title: 'a #work' },
    }]);
    expect(stored.at(-1).bookmarks[0].name).toBeUndefined();

    await leave();
    await user.click(screen.getByRole('button', { name: '進行中 #work「child」 · tasks.md › a #work' }));
    await waitFor(() => expect(titleValues()).toEqual(['child #work']));
    expect(status().value).toBe('in-progress');
    expect(search().value).toBe('child #work');
    expect(zoomTitle().value).toBe('a #work');
  });

  it('restores the "not done" filter', async () => {
    const { user, screen, titleValues, status, addView, leave } = await setupWithStore();
    await user.selectOptions(status(), 'not-done');
    await addView();
    await leave();
    await user.click(screen.getByRole('button', { name: '完了以外 · tasks.md' }));
    await waitFor(() => expect(status().value).toBe('not-done'));
    expect(titleValues()).toEqual(['a #work', 'child #work', 'other', 'b']);
  });

  it('finds the zoomed item by its title after lines moved, and shows the whole file when it is gone', async () => {
    const { user, screen, titleValues, zoomTitle } = await setupWithStore({ bookmarks: [
      { id: 'moved', kind: 'view', file: 'tasks.md', status: 'all', tags: [], searchText: '', zoom: { path: 'tasks.md', line: 9, title: 'b' } },
      { id: 'gone', kind: 'view', file: 'tasks.md', status: 'all', tags: [], searchText: '', zoom: { path: 'tasks.md', line: 0, title: 'deleted' } },
    ] });
    await user.click(screen.getByRole('button', { name: 'tasks.md › b' }));
    await waitFor(() => expect(zoomTitle().value).toBe('b'));

    await user.click(screen.getByRole('button', { name: 'tasks.md › deleted' }));
    await waitFor(() => expect(screen.getByText('ズームしていた項目「deleted」が見つかりません。ファイル全体を表示します。')).toBeTruthy());
    expect(zoomTitle()).toBeNull();
    expect(titleValues()).toEqual(['a #work', 'child #work', 'other', 'b']);
  });

  it('does not add the same view twice, and the star removes its bookmark', async () => {
    const { user, screen, stored, addView } = await setupWithStore();
    await addView();
    await addView();
    expect(screen.getByText('このブックマークは登録済みです。')).toBeTruthy();
    await flush();
    expect(stored.at(-1).bookmarks).toHaveLength(1);

    const star = screen.getByRole('button', { name: '今の表示のブックマークを解除' });
    expect(star.getAttribute('aria-pressed')).toBe('true');
    await user.click(star);
    await flush();
    expect(stored.at(-1).bookmarks).toEqual([]);
    expect(screen.getByRole('button', { name: '今の表示をブックマーク' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('renames a bookmark with Enter, keeps the name on Escape, and goes back to the default name when emptied', async () => {
    const { user, screen, stored, addView } = await setupWithStore();
    await addView();
    const nameInput = () => screen.getByRole('textbox', { name: 'ブックマーク名（Enter: 確定 · Esc: 取り消し · 空欄: 既定の名前）' });

    await user.click(screen.getByRole('button', { name: 'tasks.md の名前を変更' }));
    await user.clear(nameInput());
    await user.type(nameInput(), '仕事{Enter}');
    expect(screen.getByRole('button', { name: '仕事' })).toBeTruthy();
    await flush();
    expect(stored.at(-1).bookmarks[0].name).toBe('仕事');

    await user.click(screen.getByRole('button', { name: '仕事 の名前を変更' }));
    await user.clear(nameInput());
    await user.type(nameInput(), 'discarded{Escape}');
    expect(screen.getByRole('button', { name: '仕事' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '仕事 の名前を変更' }));
    await user.clear(nameInput());
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'tasks.md' })).toBeTruthy();
    await flush();
    expect(stored.at(-1).bookmarks[0]).not.toHaveProperty('name');
  });

  it('still opens file and search bookmarks saved by 0.1.x', async () => {
    const { user, screen, titleValues, status, search, zoomTitle, leave } = await setupWithStore({ bookmarks: [
      // A file bookmark shows the file without filters, whatever else it holds.
      { id: 'file', kind: 'file', file: 'tasks.md', status: 'done', tags: ['work'] },
      { id: 'search', kind: 'search', file: 'tasks.md', status: 'in-progress', tags: ['work'], searchText: 'child' },
    ] });
    await leave();
    await user.click(screen.getByRole('button', { name: '進行中 #work「child」 · tasks.md' }));
    await waitFor(() => expect(titleValues()).toEqual(['a #work', 'child #work']));
    expect(status().value).toBe('in-progress');
    expect(search().value).toBe('child #work');

    await user.click(screen.getByRole('button', { name: 'tasks.md' }));
    await waitFor(() => expect(titleValues()).toEqual(['a #work', 'child #work', 'other', 'b']));
    expect(status().value).toBe('all');
    expect(search().value).toBe('');
    expect(zoomTitle()).toBeNull();
    // The old file bookmark already holds this view.
    expect(screen.getByRole('button', { name: '今の表示のブックマークを解除' })).toBeTruthy();
  });
});
