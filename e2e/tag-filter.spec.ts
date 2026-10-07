import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const search = (page: Page) => page.getByRole('searchbox', { name: 'Filter by words or tags' });
const fields = (page: Page) => page.getByRole('textbox', { name: 'Item text' });

test.describe('#tags in item text', () => {
  test('are shown like links, and a click adds the tag to the search once and filters', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] chores #home\n- [ ] report #work\n- [ ] both #home #work\n');
    const tag = page.locator('.title-display .tag', { hasText: '#home' }).first();
    await expect(tag).toHaveCSS('text-decoration-line', 'underline');
    await expect(tag).toHaveCSS('cursor', 'pointer');

    await tag.click();
    await expect(search(page)).toHaveValue('#home');
    await expect.poll(outliner.titles).toEqual(['chores #home', 'both #home #work']);

    await page.locator('.title-display .tag', { hasText: '#home' }).first().click();
    await expect(search(page)).toHaveValue('#home');
  });

  test('a click on other text edits with the caret where it was clicked', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] chores #home\n');
    await page.locator('.title-display').getByText('chores').click({ position: { x: 1, y: 8 } });
    await expect(fields(page).first()).toBeFocused();
    await page.keyboard.type('X');
    await expect.poll(outliner.saved).toBe('- [ ] Xchores #home\n');
    await expect(search(page)).toHaveValue('');
  });

  test('with filter matches highlighted, a click edits with the caret where it was clicked and a tag still filters', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] buy milkshake #home\n- [ ] other #work\n');
    await search(page).fill('milk');
    await search(page).press('Enter');
    await expect(page.locator('.title-display mark')).toHaveText(['milk']);

    // Inside the mark, and in the plain text after it, the caret lands at the clicked offset.
    await page.locator('.title-display mark').click({ position: { x: 1, y: 8 } });
    await page.keyboard.type('X');
    await expect.poll(outliner.saved).toBe('- [ ] buy Xmilkshake #home\n- [ ] other #work\n');
    // Leaving the title shows the rendered text again.
    await search(page).click();
    await page.locator('.title-display').getByText('shake').click({ position: { x: 1, y: 8 } });
    await page.keyboard.type('Y');
    await expect.poll(outliner.saved).toBe('- [ ] buy XmilkYshake #home\n- [ ] other #work\n');

    await search(page).click();
    await page.locator('.title-display .tag', { hasText: '#home' }).click();
    await expect(search(page)).toHaveValue('milk #home');
  });

  test('a tag next to a link works too', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] see [docs](https://example.com) #work\n- [ ] other #home\n');
    await page.locator('.title-display .tag', { hasText: '#work' }).click();
    await expect(search(page)).toHaveValue('#work');
    await expect.poll(outliner.titles).toEqual(['see [docs](https://example.com) #work']);
  });

  test('while editing, ⌘/Ctrl-click on a tag filters and a plain click places the caret', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] #home chores\n- [ ] #work report\n');
    const field = fields(page).first();
    // Clicking the text starts editing; the textarea is then on top. Its tag starts the title.
    await page.locator('.title-display').first().getByText('chores').click();
    await expect(field).toBeFocused();
    await field.click({ position: { x: 12, y: 12 } });
    await expect(search(page)).toHaveValue('');
    await field.click({ position: { x: 12, y: 12 }, modifiers: ['ControlOrMeta'] });
    await expect(search(page)).toHaveValue('#home');
    await expect.poll(outliner.titles).toEqual(['#home chores']);
  });
});
