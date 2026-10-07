import type { Locator, Page } from '@playwright/test';
import { expect, horizontalOverflow, test } from './fixtures.ts';

// Runs in the "android" project of playwright.config.ts: Chromium emulating a Pixel 7, with touch
// input and a coarse pointer. A soft keyboard has no Tab, Alt+arrows or Shift+Enter, so these
// tests only tap.

const touchBar = (page: Page) => page.getByRole('toolbar', { name: 'Edit the item' });
const focusedField = (page: Page) => page.locator('textarea:focus');
const rect = (locator: Locator) => locator.evaluate(node => node.getBoundingClientRect().toJSON() as DOMRect);

async function tapTitle(page: Page, title: string) {
  const fields = page.getByRole('textbox', { name: 'Item text' });
  const index = (await fields.evaluateAll(nodes => nodes.map(node => (node as HTMLTextAreaElement).value))).indexOf(title);
  // A title with #tags is shown as text over the field until it is edited; tap its start, not a tag.
  await fields.nth(index).locator('..').tap({ position: { x: 2, y: 8 } });
  await expect(focusedField(page)).toHaveValue(title);
}

test.describe('on a touch screen', () => {
  test('the touch bar appears while a title has focus', async ({ openOutliner, page }) => {
    await openOutliner('- [ ] a\n- [ ] b\n');
    await expect(touchBar(page)).toBeHidden();
    await tapTitle(page, 'b');
    await expect(touchBar(page)).toBeVisible();
    // It sits at the bottom of the screen, where the soft keyboard leaves it visible.
    const viewport = page.viewportSize()!;
    expect((await rect(touchBar(page))).bottom).toBeLessThanOrEqual(viewport.height);
  });

  test('indent and outdent change the level and the title keeps the focus', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] a\n- [ ] b\n');
    await tapTitle(page, 'b');
    await touchBar(page).getByRole('button', { name: 'Indent (Tab)' }).tap();
    await expect.poll(outliner.saved).toBe('- [ ] a\n  - [ ] b\n');
    await expect(focusedField(page)).toHaveValue('b');
    await touchBar(page).getByRole('button', { name: 'Outdent (Shift+Tab)' }).tap();
    await expect.poll(outliner.saved).toBe('- [ ] a\n- [ ] b\n');
    await expect(focusedField(page)).toHaveValue('b');
  });

  test('move up and down reorder items with their children and the title keeps the focus', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] a\n- [ ] b\n  - [ ] child\n');
    await tapTitle(page, 'b');
    await touchBar(page).getByRole('button', { name: 'Move up (Alt+↑)' }).tap();
    await expect.poll(outliner.saved).toBe('- [ ] b\n  - [ ] child\n- [ ] a\n');
    await expect(focusedField(page)).toHaveValue('b');
    await touchBar(page).getByRole('button', { name: 'Move down (Alt+↓)' }).tap();
    await expect.poll(outliner.saved).toBe('- [ ] a\n- [ ] b\n  - [ ] child\n');
    await expect(focusedField(page)).toHaveValue('b');
  });

  test('the status button cycles the task status and the title keeps the focus', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] a\n');
    await tapTitle(page, 'a');
    const status = touchBar(page).getByRole('button', { name: 'Change the task status' });
    await status.tap();
    await expect.poll(outliner.saved).toBe('- [/] a\n');
    await status.tap();
    await expect.poll(outliner.saved).toBe('- [x] a\n');
    await expect(focusedField(page)).toHaveValue('a');
  });

  test('the note button switches between the title and the note', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] a\n');
    await tapTitle(page, 'a');
    await touchBar(page).getByRole('button', { name: 'Switch between text and note (Shift+Enter)' }).tap();
    await expect(page.getByRole('textbox', { name: 'Item note' })).toBeFocused();
    await page.keyboard.type('memo');
    await expect.poll(outliner.saved).toBe('- [ ] a\n  memo\n');
  });

  test('the row buttons of the edited line sit under the title, without the ones the touch bar has', async ({ openOutliner, page }) => {
    const title = '来週の定例に向けて打ち合わせの資料と議題を準備して関係者に共有する #work';
    const outliner = await openOutliner(`- [ ] ${title}\n- [ ] next\n`);
    const line = await outliner.line(title);
    const addChild = line.getByTitle('Add a child task');
    await expect(addChild).toBeHidden();
    await tapTitle(page, title);
    await expect(addChild).toBeVisible();
    const field = line.getByRole('textbox', { name: 'Item text' });
    expect((await rect(addChild)).top).toBeGreaterThanOrEqual((await rect(field)).bottom);
    await expect(line.getByTitle('Move the item up')).toBeHidden();
    await expect(line.getByTitle('Edit the note')).toBeHidden();
    // Other lines keep their buttons hidden, even after a tap left :hover on them.
    await expect((await outliner.line('next')).getByTitle('Add a child task')).toBeHidden();
  });

  test('tapping the handle selects the item without changing the file', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] a\n- [ ] b\n');
    await (await outliner.handle('b')).tap();
    await expect(page.getByText('1 selected')).toBeVisible();
    // The row buttons do not cover the title of the selected line, which stays tappable.
    await expect((await outliner.line('b')).getByTitle('Add a child task')).toBeHidden();
    expect(await outliner.titles()).toEqual(['a', 'b']);
    expect(await outliner.saved()).toBe('- [ ] a\n- [ ] b\n');
  });

  test('a / opens the command menu, whose 36px rows run a command on a tap, on a 360px wide screen', async ({ openOutliner, page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const outliner = await openOutliner('- [ ] child of a long title\n');
    await tapTitle(page, 'child of a long title');
    await page.keyboard.press('End');
    await page.keyboard.type(' /');
    const menu = page.getByRole('listbox');
    await expect(menu).toBeVisible();
    const done = menu.getByRole('option', { name: 'Done', exact: true });
    expect((await rect(done)).height).toBeGreaterThanOrEqual(36);
    expect((await rect(menu)).right).toBeLessThanOrEqual(360);
    expect(await horizontalOverflow(page.locator('html'))).toBeLessThanOrEqual(0);
    await done.tap();
    await expect(menu).toBeHidden();
    await expect.poll(outliner.saved).toBe('- [x] child of a long title\n');
    await expect(focusedField(page)).toHaveValue('child of a long title');
  });

  for (const width of [360, 412]) {
    test(`a ${width}px wide screen has no horizontal scrollbar, with the bookmarks, the selection bar and the touch bar shown`, async ({ openOutliner, page }) => {
      await page.setViewportSize({ width, height: 800 });
      const outliner = await openOutliner('- [ ] 来週の定例に向けて打ち合わせの資料と議題を準備して関係者に共有する #work #priority/high\n  - [ ] child\n');
      await expect(page.getByRole('heading', { name: 'Bookmarks' })).toBeVisible();
      await (await outliner.handle('child')).tap();
      await expect(page.getByText('1 selected')).toBeVisible();
      await tapTitle(page, 'child');
      await expect(touchBar(page)).toBeVisible();
      expect(await horizontalOverflow(page.locator('html'))).toBeLessThanOrEqual(0);
      expect(await horizontalOverflow(page.locator('.outline'))).toBeLessThanOrEqual(0);
    });
  }
});
