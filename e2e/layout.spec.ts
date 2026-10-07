import type { Locator } from '@playwright/test';
import { expect, horizontalOverflow, test } from './fixtures.ts';

const title = '来週の定例に向けて打ち合わせの資料と議題を準備して関係者に共有する #work #priority/high';
const markdown = `- [ ] ${title}\n  - [ ] 机の上を整理する #home\n`;

const rect = (locator: Locator) => locator.evaluate(node => node.getBoundingClientRect().toJSON() as DOMRect);

test.describe('item titles use the width of the page', () => {
  test('on a wide page the title spans the line and fits on one line, without a horizontal scrollbar', async ({ openOutliner, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const outliner = await openOutliner(markdown);
    const line = await outliner.line(title);
    const field = line.getByRole('textbox', { name: 'Item text' });
    expect((await rect(field)).right).toBeCloseTo((await rect(line)).right, 0);
    expect(await outliner.titleLines(title)).toBe(1);
    expect(await horizontalOverflow(page.locator('html'))).toBeLessThanOrEqual(0);
    expect(await horizontalOverflow(page.locator('.outline'))).toBeLessThanOrEqual(0);
  });

  test('a phone-width page wraps the title and the selection bar instead of scrolling sideways', async ({ openOutliner, page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const outliner = await openOutliner(markdown);
    await (await outliner.handle(title)).click();
    await expect(page.getByText('1 selected')).toBeVisible();
    expect(await outliner.titleLines(title)).toBeGreaterThan(1);
    expect(await horizontalOverflow(page.locator('html'))).toBeLessThanOrEqual(0);
    expect(await horizontalOverflow(page.locator('.outline'))).toBeLessThanOrEqual(0);
  });

  test('the row buttons appear over the hovered line without rewrapping its title', async ({ openOutliner, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const outliner = await openOutliner(markdown);
    const line = await outliner.line(title);
    const addChild = line.getByTitle('Add a child task');
    await expect(addChild).toBeHidden();
    await line.hover();
    await expect(addChild).toBeVisible();
    expect(await outliner.titleLines(title)).toBe(1);
  });

  test('while a long title is edited, the row buttons sit under it instead of covering its end', async ({ openOutliner, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const outliner = await openOutliner(markdown);
    const line = await outliner.line(title);
    const field = line.getByRole('textbox', { name: 'Item text' });
    await field.click();
    await page.keyboard.press('End');
    await line.hover();
    const buttons = line.getByTitle('Add a child task').locator('..');
    await expect(buttons).toBeVisible();

    const fieldBox = await rect(field);
    const buttonsBox = await rect(buttons);
    expect(buttonsBox.top).toBeGreaterThanOrEqual(fieldBox.bottom);
    expect(fieldBox.right).toBeCloseTo((await rect(line)).right, 0);
    expect(await outliner.titleLines(title)).toBe(1);

    // The buttons stay put when the click on one of them takes the focus from the title.
    await line.getByTitle('Edit the note').click();
    await expect(page.getByRole('textbox', { name: 'Item note' })).toBeVisible();
  });

  test('while a title is edited, a click on the next line lands there', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] a\n- [ ] b\n');
    await page.getByRole('textbox', { name: 'Item text' }).first().fill('a edited');
    await (await outliner.line('b')).getByRole('button', { name: 'Not started (click for in progress)' }).click();
    await expect.poll(outliner.saved).toBe('- [ ] a edited\n- [/] b\n');
  });
});
