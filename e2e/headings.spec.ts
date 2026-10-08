import type { Page } from '@playwright/test';
import { expect, t, test } from './fixtures.ts';

const file = '# A\n\n- [ ] a1\n- [ ] a2\n\n# B\n\n- [ ] b1\n';

const headingLine = (page: Page, name: string) => page.getByRole('heading', { name, exact: true }).locator('xpath=ancestor::div[contains(@class, "outline-line")][1]');

// Items move between the sections of a Markdown file; the headings themselves are read-only rows.
test.describe('items across headings', () => {
  test('Alt+Down and Alt+Up move an item into the next and back into the previous section', async ({ openOutliner, page }) => {
    const outliner = await openOutliner(file);
    await expect(page.getByRole('heading', { name: 'A', exact: true })).toBeVisible();
    const a2 = page.getByRole('textbox', { name: t.item.title }).nth(1);
    await a2.click();
    await page.keyboard.press('Alt+ArrowDown');
    expect(await outliner.titles()).toEqual(['a1', 'a2', 'b1']);
    await expect.poll(outliner.saved).toBe('# A\n\n- [ ] a1\n\n# B\n\n- [ ] a2\n- [ ] b1\n');
    await expect(page.getByRole('textbox', { name: t.item.title }).nth(1)).toBeFocused();
    await page.keyboard.press('Alt+ArrowUp');
    await expect.poll(outliner.saved).toBe(file);
  });

  test('dropping an item on a heading puts it at the end of that heading\'s list', async ({ openOutliner, page }) => {
    const outliner = await openOutliner(file);
    const source = await (await outliner.handle('a1')).boundingBox();
    const target = await headingLine(page, 'B').boundingBox();
    if (!source || !target) throw new Error('Element is not visible');
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect.poll(outliner.saved).toBe('# A\n\n- [ ] a2\n\n# B\n\n- [ ] b1\n- [ ] a1\n');
  });

  test('dropping an item next to an item of another section moves it into that section', async ({ openOutliner }) => {
    const outliner = await openOutliner(file);
    await outliner.drag('b1', 'a1', { edge: 'before' });
    await expect.poll(outliner.saved).toBe('# A\n\n- [ ] b1\n- [ ] a1\n- [ ] a2\n\n# B\n\n');
    expect(await outliner.titles()).toEqual(['b1', 'a1', 'a2']);
  });

  test('a heading folds its section', async ({ openOutliner, page }) => {
    const outliner = await openOutliner(file);
    await headingLine(page, 'A').getByTitle(t.item.fold).click();
    expect(await outliner.titles()).toEqual(['b1']);
  });
});
