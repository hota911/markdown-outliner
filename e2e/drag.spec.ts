import type { Locator, Page } from '@playwright/test';
import { expect, t, test } from './fixtures.ts';

// Dragging uses HTML5 drag and drop on the ⠿ handle, which jsdom cannot run (test/ui), so
// these tests drive a real Chromium with the mouse against server.mjs and a file on disk.
test.describe('drag and drop', () => {
  test('dropping on the top edge of a sibling moves the item before it', async ({ openOutliner }) => {
    const outliner = await openOutliner('- [ ] a\n- [ ] b\n- [ ] c\n');
    await outliner.drag('c', 'a', { edge: 'before' });
    expect(await outliner.titles()).toEqual(['c', 'a', 'b']);
    await expect.poll(outliner.saved).toBe('- [ ] c\n- [ ] a\n- [ ] b\n');
  });

  test('dropping on the bottom edge of a sibling moves the item after it, with its children', async ({ openOutliner }) => {
    const outliner = await openOutliner('- [ ] a\n  - [ ] child\n- [ ] b\n');
    await outliner.drag('a', 'b', { edge: 'after' });
    expect(await outliner.titles()).toEqual(['b', 'a', 'child']);
    await expect.poll(outliner.saved).toBe('- [ ] b\n- [ ] a\n  - [ ] child\n');
  });

  test('dropping on the middle of an item without children puts the item under it', async ({ openOutliner }) => {
    const outliner = await openOutliner('- [ ] a\n- [ ] b\n- [ ] c\n');
    await outliner.drag('c', 'a', { edge: 'child' });
    await expect.poll(outliner.saved).toBe('- [ ] a\n  - [ ] c\n- [ ] b\n');
  });

  test('a folded item stays folded when it is dragged under another item', async ({ openOutliner }) => {
    const outliner = await openOutliner('- [ ] a\n  - [ ] a1\n- [ ] b\n- [ ] c\n');
    await (await outliner.line('a')).getByTitle(t.item.fold).click();
    expect(await outliner.titles()).toEqual(['a', 'b', 'c']);
    await outliner.drag('a', 'c', { edge: 'child' });
    await expect.poll(outliner.saved).toBe('- [ ] b\n- [ ] c\n  - [ ] a\n    - [ ] a1\n');
    expect(await outliner.titles()).toEqual(['b', 'c', 'a']);
  });

  test('the indent of the insertion line sets the level: at the child title the item joins the children', async ({ openOutliner }) => {
    const outliner = await openOutliner('- [ ] a\n  - [ ] a1\n- [ ] b\n- [ ] c\n');
    await outliner.drag('c', 'a1', { edge: 'after' });
    await expect.poll(outliner.saved).toBe('- [ ] a\n  - [ ] a1\n  - [ ] c\n- [ ] b\n');
  });

  test('the indent of the insertion line sets the level: one level left of the child title the item goes after the parent', async ({ openOutliner }) => {
    const outliner = await openOutliner('- [ ] a\n  - [ ] a1\n- [ ] b\n- [ ] c\n');
    await outliner.drag('c', 'a1', { edge: 'after', outdent: 1 });
    await expect.poll(outliner.saved).toBe('- [ ] a\n  - [ ] a1\n- [ ] c\n- [ ] b\n');
  });

  test('dragging a child out to the top level', async ({ openOutliner }) => {
    const outliner = await openOutliner('- [ ] a\n  - [ ] a1\n- [ ] b\n');
    await outliner.drag('a1', 'b', { edge: 'after' });
    await expect.poll(outliner.saved).toBe('- [ ] a\n- [ ] b\n- [ ] a1\n');
  });

  test('dragging one of several selected items moves the whole selection', async ({ openOutliner }) => {
    const outliner = await openOutliner('- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n');
    await (await outliner.handle('a')).click();
    await (await outliner.handle('b')).click({ modifiers: ['Shift'] });
    await outliner.drag('b', 'd', { edge: 'after' });
    expect(await outliner.titles()).toEqual(['c', 'd', 'a', 'b']);
    await expect.poll(outliner.saved).toBe('- [ ] c\n- [ ] d\n- [ ] a\n- [ ] b\n');
  });

  test('dropping a selection on the middle of an item puts all of it under that item', async ({ openOutliner }) => {
    const outliner = await openOutliner('- [ ] a\n- [ ] b\n- [ ] c\n');
    await (await outliner.handle('a')).click();
    await (await outliner.handle('b')).click({ modifiers: ['Shift'] });
    await outliner.drag('a', 'c', { edge: 'child' });
    await expect.poll(outliner.saved).toBe('- [ ] c\n  - [ ] a\n  - [ ] b\n');
  });
});

// The embedded file does not exist, so the embed shows an error, but its line is still moved like an item.
test.describe('drag and drop of embed lines', () => {
  const embedLine = (page: Page) => page.locator('.outline-line', { has: page.locator('.embed-title', { hasText: 'other.md' }) });

  async function dragTo(page: Page, handle: Locator, line: Locator, edge: 'before' | 'after') {
    const source = await handle.boundingBox();
    const target = await line.boundingBox();
    if (!source || !target) throw new Error('Element is not visible');
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height * (edge === 'before' ? 0.1 : 0.9), { steps: 10 });
    await page.mouse.up();
  }

  test('an embed line is dragged by its handle before an item', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] a\n- [ ] b\n- ![[other.md]]\n');
    await dragTo(page, embedLine(page).getByTitle(t.item.dragHandle), await outliner.line('a'), 'before');
    await expect.poll(outliner.saved).toBe('- ![[other.md]]\n- [ ] a\n- [ ] b\n');
  });

  test('an item is dragged before and after an embed line', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] a\n- ![[other.md]]\n- [ ] b\n');
    await dragTo(page, await outliner.handle('b'), embedLine(page), 'before');
    await expect.poll(outliner.saved).toBe('- [ ] a\n- [ ] b\n- ![[other.md]]\n');
    await dragTo(page, await outliner.handle('a'), embedLine(page), 'after');
    await expect.poll(outliner.saved).toBe('- [ ] b\n- ![[other.md]]\n- [ ] a\n');
  });
});
