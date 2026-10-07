import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const search = (page: Page) => page.getByRole('searchbox', { name: 'Filter by words or tags' });

// Every title starts with its tag, so a point a few pixels into the text is on the tag.
async function clickTag(target: Locator, modifiers: 'ControlOrMeta'[] = ['ControlOrMeta']) {
  await target.click({ position: { x: 12, y: 12 }, modifiers });
}

test.describe('⌘/Ctrl-click on a #tag', () => {
  test('adds the tag to the search once and filters; a plain click edits', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] #home chores\n- [ ] #work report\n- [ ] #home #work both\n');
    const field = page.getByRole('textbox', { name: 'Item text' }).first();

    await clickTag(field, []);
    await expect(field).toBeFocused();
    await expect(search(page)).toHaveValue('');

    await clickTag(field);
    await expect(search(page)).toHaveValue('#home');
    await expect.poll(outliner.titles).toEqual(['#home chores', '#home #work both']);

    await clickTag(page.getByRole('textbox', { name: 'Item text' }).first());
    await expect(search(page)).toHaveValue('#home');
  });

  test('works on a title shown with links', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] #work see [docs](https://example.com)\n- [ ] #home other\n');
    await clickTag(page.locator('.title-display'));
    await expect(search(page)).toHaveValue('#work');
    await expect.poll(outliner.titles).toEqual(['#work see [docs](https://example.com)']);
  });
});
