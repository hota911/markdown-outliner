import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const items = Array.from({ length: 300 }, (_, index) => `item ${index + 1}`);
const longFile = items.map(title => `- [ ] ${title}\n`).join('');

const rect = (locator: Locator) => locator.evaluate(node => node.getBoundingClientRect().toJSON() as DOMRect);
const header = (page: Page) => page.locator('.pinned-header');

test.describe('the header stays at the top of a long file', () => {
  test('scrolled to the bottom, the header is still at the top of the viewport', async ({ openOutliner, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openOutliner(longFile);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);

    const box = await rect(header(page));
    expect(box.top).toBeCloseTo(0, 0);
    expect(box.bottom).toBeLessThan(800);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
  });

  test('moving up with the keyboard after scrolling keeps the focused row below the header', async ({ openOutliner, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const outliner = await openOutliner(longFile);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = (await outliner.line('item 300')).getByRole('textbox', { name: 'Item text' });
    await last.locator('..').click({ position: { x: 2, y: 8 } });
    await expect(last).toBeFocused();

    // Row by row up past the top of the viewport, so that the page has to scroll back. A row that moves
    // under the header still counts as visible to the browser, so every step is checked.
    for (let step = 1; step <= 40; step++) {
      await page.keyboard.press('ArrowUp');
      const focused = (await outliner.line(`item ${300 - step}`)).getByRole('textbox', { name: 'Item text' });
      await expect(focused).toBeFocused();
      expect((await rect(focused)).top).toBeGreaterThanOrEqual((await rect(header(page))).bottom - 1);
    }
  });

  test('zoomed into an item, the zoom bar stays pinned with the header', async ({ openOutliner, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openOutliner(`- [ ] parent\n${items.map(title => `  - [ ] ${title}\n`).join('')}`);
    // The row buttons show while the title is edited.
    await page.getByRole('textbox', { name: 'Item text' }).first().click();
    await page.getByTitle('Zoom into this item').first().click();
    const zoomOut = page.getByTitle('Leave the zoomed item');
    await expect(zoomOut).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
    await expect(zoomOut).toBeInViewport();
  });
});
