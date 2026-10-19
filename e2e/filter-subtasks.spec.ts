import { expect, t, test } from './fixtures.ts';

test('the "N more" button of an in-progress task shows its done and not started subtasks, dimmed', async ({ openOutliner, page }) => {
  const { titles } = await openOutliner('- [/] a\n  - [ ] todo\n  - [x] done\n- [/] b\n  - [ ] other\n');
  await page.getByRole('combobox', { name: t.toolbar.filter }).selectOption('in-progress');
  await expect.poll(titles).toEqual(['a', 'b']);
  const more = page.getByRole('button', { name: t.item.showMoreLabel(2, 'a') });
  await expect(more).toHaveText(t.item.showMore(2));
  await more.click();
  await expect.poll(titles).toEqual(['a', 'todo', 'done', 'b']);
  const dimmed = page.locator('.outline-item.is-context > .outline-line');
  await expect(dimmed).toHaveCount(2);
  expect(await dimmed.first().evaluate(node => getComputedStyle(node).opacity)).toBe('0.6');
  await expect(page.getByRole('button', { name: t.item.showMoreLabel(1, 'b') })).toBeVisible();
  const hide = page.getByRole('button', { name: t.item.hideMoreLabel(2, 'a') });
  await expect(hide).toHaveText(t.item.hideMore);
  await hide.focus();
  await page.keyboard.press('Enter');
  await expect.poll(titles).toEqual(['a', 'b']);
});
