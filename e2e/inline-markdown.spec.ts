import { expect, test } from './fixtures.ts';

test.describe('inline Markdown in titles and notes', () => {
  test('clicking rendered text starts editing at the clicked character', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] read [docs](https://example.com) now\n  see **bold** text\n');
    // The left edge of the first character puts the caret before it.
    await page.locator('.note-display strong').click({ position: { x: 1, y: 5 } });
    await expect(page.getByRole('textbox', { name: 'Item note' })).toBeFocused();
    await page.keyboard.type('X');
    await page.locator('.title-display span').last().click({ position: { x: 1, y: 5 } });
    await page.keyboard.type('Y');
    await expect.poll(outliner.saved).toBe('- [ ] read [docs](https://example.com)Y now\n  see **Xbold** text\n');
  });

  test('Enter at the end of rendered text clicked into editing adds an item, or a line in a note', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] read **docs**\n  see `code`\n- [ ] next\n');
    // The right edge of the last character puts the caret at the end.
    const endOf = async (selector: string) => {
      const box = (await page.locator(selector).boundingBox())!;
      await page.mouse.click(box.x + box.width - 1, box.y + box.height / 2);
    };
    await endOf('.note-display code');
    await page.keyboard.press('Enter');
    await page.keyboard.type('line');
    await endOf('.title-display strong');
    await page.keyboard.press('Enter');
    await page.keyboard.type('new');
    await expect.poll(outliner.saved).toBe('- [ ] read **docs**\n  see `code`\n  line\n- [ ] new\n- [ ] next\n');
  });

  test('clicking a link in a note opens it in a new tab', async ({ openOutliner, page, context }) => {
    await context.route('https://example.com/**', route => route.fulfill({ body: 'docs' }));
    await openOutliner('- [ ] a\n  see [docs](https://example.com/docs)\n');
    const popup = page.waitForEvent('popup');
    await page.locator('.note-display a').click();
    await expect.poll(async () => (await popup).url()).toBe('https://example.com/docs');
    await expect(page.getByRole('textbox', { name: 'Item note' })).not.toBeFocused();
  });
});
