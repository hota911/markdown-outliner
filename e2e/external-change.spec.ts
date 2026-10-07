import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

// Two pages on the same server stand in for two browser tabs editing the same file.
const fields = (page: Page) => page.getByRole('textbox', { name: 'Item text' });
const status = (page: Page) => page.locator('.save-state');

// Adds "inserted" right after "top" in another tab, above the item focused in the first tab.
async function insertFromOtherTab(page: Page) {
  const other = await page.context().newPage();
  await other.goto(page.url());
  await fields(other).first().click();
  await other.keyboard.press('End');
  await other.keyboard.press('Enter');
  await other.keyboard.type('inserted');
}

test.describe('external changes while a field has focus', () => {
  test('wait in a tab whose field keeps the focus, then show on the same item when the tab is shown again', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] top\n- [ ] alpha\n');
    const alpha = fields(page).nth(1);
    await alpha.click();
    await alpha.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(2, 2));

    await insertFromOtherTab(page);
    await expect.poll(outliner.saved).toBe('- [ ] top\n- [ ] inserted\n- [ ] alpha\n');
    // Headless Chromium treats every page as visible and focused, like a tab switch that keeps the focus.
    await expect(status(page)).toHaveText('Changed elsewhere (shown when you leave the field)');
    expect(await outliner.titles()).toEqual(['top', 'alpha']);

    // page.bringToFront() fires no event in headless Chromium, so the event of a tab switch is sent here.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(outliner.titles).toEqual(['top', 'inserted', 'alpha']);
    await expect(fields(page).nth(2)).toBeFocused();
    await page.keyboard.type('!');
    await expect.poll(outliner.saved).toBe('- [ ] top\n- [ ] inserted\n- [ ] al!pha\n');
    await expect(status(page)).toHaveText('Saved');
  });

  test('show while the outliner is hidden, as in a background Obsidian tab', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] top\n- [ ] alpha\n');
    await fields(page).nth(1).click();
    // Hiding the focused field blurs it, so the change is not deferred.
    await page.locator('#app').evaluate((node: HTMLElement) => { node.style.display = 'none'; });

    await insertFromOtherTab(page);
    await expect.poll(outliner.saved).toBe('- [ ] top\n- [ ] inserted\n- [ ] alpha\n');
    await page.locator('#app').evaluate((node: HTMLElement) => { node.style.display = ''; });
    await expect.poll(outliner.titles).toEqual(['top', 'inserted', 'alpha']);
    await expect(status(page)).toHaveText('Saved');
  });
});
