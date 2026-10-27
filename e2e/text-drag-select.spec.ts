import type { Page } from '@playwright/test';
import { expect, t, test } from './fixtures.ts';

// Each title is a field of its own, so a text selection cannot reach another item; jsdom (test/ui)
// has no layout to drag across, so these tests use a real Chromium.
async function dragText(page: Page, from: string, to: string) {
  const box = async (title: string) => {
    const handle = await page.evaluateHandle(value => [...document.querySelectorAll<HTMLTextAreaElement>('textarea[data-field="title"]')].find(node => node.value === value)!, title);
    const rect = await handle.evaluate(node => node.closest('.title-area')!.getBoundingClientRect().toJSON() as DOMRect);
    return rect;
  };
  const start = await box(from), end = await box(to);
  await page.mouse.move(start.x + 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 3, start.y + start.height / 2, { steps: 3 });
  await page.mouse.move(end.x + 10, end.y + end.height / 2, { steps: 10 });
  // Selecting items shows the selection bar above the outline, which moves the items down.
  const moved = await box(to);
  await page.mouse.move(moved.x + 10, moved.y + moved.height / 2, { steps: 3 });
  await page.mouse.up();
}

const selected = (page: Page) => page.locator('.outline-item.is-selected [data-field="title"]').evaluateAll(nodes => nodes.map(node => (node as HTMLTextAreaElement).value));

test.describe('dragging a text selection across items', () => {
  test('selects the items from the first one to the one reached', async ({ page, openOutliner }) => {
    await openOutliner('- [ ] alpha\n- [ ] beta\n- [ ] gamma\n- [ ] delta\n');
    await dragText(page, 'alpha', 'gamma');
    expect(await selected(page)).toEqual(['alpha', 'beta', 'gamma']);
    await expect(page.getByText(t.toolbar.selected(3))).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-field') ?? null)).toBeNull();
  });

  test('a drag inside one title still selects its text', async ({ page, openOutliner }) => {
    await openOutliner('- [ ] alpha beta\n- [ ] gamma\n');
    await dragText(page, 'alpha beta', 'alpha beta');
    expect(await selected(page)).toEqual([]);
    expect(await page.evaluate(() => {
      const node = document.activeElement as HTMLTextAreaElement;
      return node.dataset.field === 'title' && node.selectionEnd > node.selectionStart;
    })).toBe(true);
  });

  test('from a child to the sibling of its parent, it selects the parent and that sibling', async ({ page, openOutliner }) => {
    await openOutliner('- [ ] parent\n  - [ ] child\n- [ ] next\n');
    await dragText(page, 'child', 'next');
    expect(await selected(page)).toEqual(['parent', 'next']);
  });
});

test('Delete deletes the items selected by a drag, and Undo brings them back', async ({ page, openOutliner }) => {
  const outliner = await openOutliner('- [ ] alpha\n- [ ] beta\n- [ ] gamma\n- [ ] delta\n');
  await dragText(page, 'alpha', 'beta');
  expect(await selected(page)).toEqual(['alpha', 'beta']);
  await page.keyboard.press('Delete');
  await expect.poll(outliner.saved).toBe('- [ ] gamma\n- [ ] delta\n');
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(outliner.titles).toEqual(['alpha', 'beta', 'gamma', 'delta']);
});
