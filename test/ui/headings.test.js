import { describe, expect, it } from 'vitest';
import { fireEvent, within } from '@testing-library/dom';
import { setup } from './harness.js';

const file = '---\ntitle: plan\n---\n# Week\n\n- [ ] a\n  note of a\n- [ ] b\n\n## Monday\n- [ ] m\n\nA paragraph.\n\n# Later\n- [ ] l\n';

const heading = (screen, name) => within(screen.getByRole('heading', { name }).closest('.outline-item'));

describe('headings', () => {
  it('shows headings as read-only rows with the items of their sections under them', async () => {
    const { screen, titleValues, row } = await setup({ 'tasks.md': file });
    expect(screen.getAllByRole('heading').filter(node => node.closest('.outline-item')).map(node => [node.textContent, node.getAttribute('aria-level')]))
      .toEqual([['Week', '1'], ['Monday', '2'], ['Later', '1']]);
    expect(titleValues()).toEqual(['a', 'b', 'm', 'l']);
    // No text field, status, handle, or note on a heading.
    expect(heading(screen, 'Week').queryByRole('textbox')).toBeNull();
    expect(heading(screen, 'Week').queryByTitle('項目を選択／ドラッグして移動')).toBeNull();
    const depth = value => row(value).getByRole('textbox', { name: '項目の内容' }).closest('.outline-item').style.getPropertyValue('--depth');
    expect(['a', 'm', 'l'].map(depth)).toEqual(['1', '2', '1']);
  });

  it('moves the last item of a section into the next section with Alt+Down, keeping other lines', async () => {
    const { user, title, saved } = await setup({ 'tasks.md': file });
    await user.click(title('b'));
    fireEvent.keyDown(title('b'), { key: 'ArrowDown', altKey: true });
    expect(document.activeElement).toBe(title('b'));
    expect(await saved()).toBe('---\ntitle: plan\n---\n# Week\n\n- [ ] a\n  note of a\n\n## Monday\n- [ ] b\n- [ ] m\n\nA paragraph.\n\n# Later\n- [ ] l\n');
  });

  it('moves the first item of a section back with Alt+Up', async () => {
    const { user, title, saved } = await setup({ 'tasks.md': file });
    await user.click(title('m'));
    fireEvent.keyDown(title('m'), { key: 'ArrowUp', altKey: true });
    expect(await saved()).toBe('---\ntitle: plan\n---\n# Week\n\n- [ ] a\n  note of a\n- [ ] b\n- [ ] m\n\n## Monday\n\nA paragraph.\n\n# Later\n- [ ] l\n');
  });

  it('leaves the text of a section in place when its last item moves to the next section', async () => {
    const { user, title, saved } = await setup({ 'tasks.md': file });
    await user.click(title('m'));
    fireEvent.keyDown(title('m'), { key: 'ArrowDown', altKey: true });
    expect(await saved()).toBe('---\ntitle: plan\n---\n# Week\n\n- [ ] a\n  note of a\n- [ ] b\n\n## Monday\n\nA paragraph.\n\n# Later\n- [ ] m\n- [ ] l\n');
  });

  it('adds the first item of a heading with its + button', async () => {
    const { user, screen, saved } = await setup({ 'tasks.md': file });
    await user.click(heading(screen, 'Later').getByTitle('この見出しの先頭に項目を追加'));
    await user.keyboard('new');
    expect(await saved()).toBe(file.replace('# Later\n', '# Later\n- [ ] new\n'));
  });

  it('folds a heading and keeps the fold when an item moves out of it', async () => {
    const { user, screen, title, titleValues } = await setup({ 'tasks.md': file });
    await user.click(heading(screen, 'Monday').getByTitle('子項目を折りたたむ／開く'));
    expect(titleValues()).toEqual(['a', 'b', 'l']);
    await user.click(title('b'));
    fireEvent.keyDown(title('b'), { key: 'ArrowDown', altKey: true });
    // b went into the folded section, so it is hidden with it.
    expect(titleValues()).toEqual(['a', 'l']);
  });

  it('shows a heading only as the context of a matching item', async () => {
    const { user, screen, titleValues } = await setup({ 'tasks.md': file });
    await user.type(screen.getByRole('searchbox', { name: '語句・タグで絞り込み' }), 'Later{Enter}');
    expect(titleValues()).toEqual([]);
    await user.clear(screen.getByRole('searchbox', { name: '語句・タグで絞り込み' }));
    await user.type(screen.getByRole('searchbox', { name: '語句・タグで絞り込み' }), 'm{Enter}');
    expect(titleValues()).toEqual(['m']);
    expect(screen.getByRole('heading', { name: 'Monday' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Week' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Later' })).toBeNull();
  });

  it('zooms into a heading without letting its items move out of it', async () => {
    const { user, screen, title, titleValues, saved } = await setup({ 'tasks.md': '# A\n- [ ] x\n## A1\n- [ ] y\n# B\n- [ ] z\n' });
    await user.click(heading(screen, 'A').getByTitle('この項目にズーム'));
    expect(screen.queryByRole('textbox', { name: 'ズーム対象のタイトル' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'A', level: 1 }).closest('.zoom-heading')).toBeTruthy();
    expect(titleValues()).toEqual(['x', 'y']);
    // Within the zoomed heading, x moves into its subsection; y does not leave it for B.
    await user.click(title('x'));
    fireEvent.keyDown(title('x'), { key: 'ArrowDown', altKey: true });
    await user.click(title('y'));
    fireEvent.keyDown(title('y'), { key: 'ArrowDown', altKey: true });
    expect(titleValues()).toEqual(['x', 'y']);
    expect(await saved()).toBe('# A\n## A1\n- [ ] x\n- [ ] y\n# B\n- [ ] z\n');
  });

  it('refuses to merge an item into a heading', async () => {
    const { user, screen, title, saved } = await setup({ 'tasks.md': '# A\n- [ ] x\n' });
    await user.click(title('x'));
    await user.keyboard('{Home}{Backspace}');
    expect(await screen.findByText('本文をまたいでタスクを結合できません')).toBeTruthy();
    expect(await saved()).toBe('# A\n- [ ] x\n');
  });
});
