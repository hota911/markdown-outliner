import { describe, expect, it } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/dom';
import { setup } from './harness.js';

const menu = () => document.querySelector('[role="menu"]');
const items = () => within(menu()).getAllByRole('menuitem');
const labels = () => items().map(node => node.textContent);
// Svelte renders the menu after the event.
async function open(node) {
  const shown = fireEvent.contextMenu(node);
  await waitFor(() => expect(menu()).toBeTruthy());
  return shown;
}
const handle = (row) => row.getByTitle('項目を選択／ドラッグして移動');

describe('the context menu', () => {
  it('opens on the handle, the status and the margin of an item with the commands of the / menu', async () => {
    const { user, screen, row, title } = await setup({ 'tasks.md': '- [ ] A\n- [ ] B\n' });
    await user.type(title('A'), ' /');
    const slash = within(screen.getByRole('listbox')).getAllByRole('option').map(node => node.textContent);
    await user.keyboard('{Escape}');
    expect(await open(handle(row('B')))).toBe(false);
    expect(labels()).toEqual(slash);
    expect(document.activeElement).toBe(items()[0]);
    await user.keyboard('{Escape}');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(handle(row('B')));
    await open(title('B').closest('.outline-line').querySelector('.task-status'));
    await user.click(document.body);
    expect(menu()).toBeNull();
    await open(title('B').closest('.outline-line'));
  });

  it('keeps the native menu on the text', async () => {
    const { title } = await setup({ 'tasks.md': '- [ ] A\n  memo\n' });
    expect(fireEvent.contextMenu(title('A'))).toBe(true);
    expect(menu()).toBeNull();
  });

  it('runs a command on the item, in one undo step', async () => {
    const { user, screen, row, saved } = await setup({ 'tasks.md': '- [ ] A\n- [ ] B\n' });
    await open(handle(row('B')));
    await user.click(within(menu()).getByRole('menuitem', { name: '進行中' }));
    expect(menu()).toBeNull();
    expect(await saved()).toBe('- [ ] A\n- [/] B\n');
    await user.click(screen.getByTitle('元に戻す'));
    expect(await saved()).toBe('- [ ] A\n- [ ] B\n');
  });

  it('moves between commands with the arrow keys and runs one with Enter', async () => {
    const { user, row, titleValues, saved } = await setup({ 'tasks.md': '- [ ] A\n- [ ] B\n  - [ ] B1\n' });
    await open(handle(row('B')));
    await user.keyboard('{End}');
    expect(document.activeElement.textContent).toBe('削除');
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items()[0]);
    await user.keyboard('{ArrowUp}{Enter}');
    expect(await saved()).toBe('- [ ] A\n');
    expect(titleValues()).toEqual(['A']);
  });

  it('opens the file list for embedding under the title', async () => {
    const { user, screen, row, title, saved } = await setup({ 'tasks.md': '- [ ] A\n', 'other.md': '- [ ] X\n' });
    await open(handle(row('A')));
    await user.click(within(menu()).getByRole('menuitem', { name: '既存のファイルを埋め込む' }));
    expect(title('A /')).toBe(document.activeElement);
    await waitFor(() => expect(within(screen.getByRole('listbox')).getAllByRole('option').map(node => node.textContent)).toContain('other.md'));
    await user.keyboard('{Enter}');
    expect(await saved()).toBe('- [ ] A\n- ![[other.md]]\n');
  });
});
