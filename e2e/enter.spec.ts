import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const fields = (page: Page) => page.getByRole('textbox', { name: 'Item text' });
const undoKey = process.platform === 'darwin' ? 'Meta+z' : 'Control+z';

async function caretAt(page: Page, index: number, position: number) {
  const field = fields(page).nth(index);
  await field.click();
  await field.evaluate((node: HTMLTextAreaElement, at) => node.setSelectionRange(at, at), position);
}

test.describe('Enter in an item text', () => {
  test('at the start adds an item above that keeps the note and children with the original, and undo removes it', async ({ openOutliner, page }) => {
    const markdown = '- [ ] top\n- [/] parent\n  memo\n  - [ ] child\n';
    const outliner = await openOutliner(markdown);
    await caretAt(page, 1, 0);
    await page.keyboard.press('Enter');
    await expect.poll(outliner.titles).toEqual(['top', '', 'parent', 'child']);
    // The caret stays at the start of the original item, so typing goes there.
    await expect(fields(page).nth(2)).toBeFocused();
    await page.keyboard.type('my ');
    await expect.poll(outliner.saved).toBe('- [ ] top\n- [ ] \n- [/] my parent\n  memo\n  - [ ] child\n');

    await page.keyboard.press(undoKey);
    await page.keyboard.press(undoKey);
    await expect.poll(outliner.titles).toEqual(['top', 'parent', 'child']);
    await expect.poll(outliner.saved).toBe(markdown);
  });

  test('in the middle of the text still adds an item after the item and its children', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] parent\n  - [ ] child\n- [ ] next\n');
    await caretAt(page, 0, 3);
    await page.keyboard.press('Enter');
    await expect.poll(outliner.titles).toEqual(['parent', 'child', '', 'next']);
    await expect(fields(page).nth(2)).toBeFocused();
    await page.keyboard.type('new');
    await expect.poll(outliner.saved).toBe('- [ ] parent\n  - [ ] child\n- [ ] new\n- [ ] next\n');
  });
});

test.describe('Enter in a note', () => {
  test('at the end starts a new line of the note', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] a\n  memo\n- [ ] b\n');
    const note = page.getByRole('textbox', { name: 'Item note' });
    await note.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(note).toHaveValue('memo\n');
    await page.keyboard.type('more');
    await expect(note).toHaveValue('memo\nmore');
    await expect.poll(outliner.saved).toBe('- [ ] a\n  memo\n  more\n- [ ] b\n');
  });
});
