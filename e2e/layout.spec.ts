import { expect, horizontalOverflow, test } from './fixtures.ts';

const title = '来週の定例に向けて打ち合わせの資料と議題を準備して関係者に共有する #work #priority/high';
const markdown = `- [ ] ${title}\n  - [ ] 机の上を整理する #home\n`;

test.describe('item titles use the width of the page', () => {
  test('on a wide page the title spans the line and fits on one line, without a horizontal scrollbar', async ({ openOutliner, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const outliner = await openOutliner(markdown);
    const line = await outliner.line(title);
    const field = line.getByRole('textbox', { name: 'Item text' });
    const right = async (locator: typeof line) => (await locator.evaluate(node => node.getBoundingClientRect().right));
    expect(await right(field)).toBeCloseTo(await right(line), 0);
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
});
