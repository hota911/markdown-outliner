import { expect, t, test } from './fixtures.ts';

test('"Show subtasks" shows the done and not started subtasks of an in-progress task, dimmed', async ({ openOutliner, page }) => {
  await openOutliner('- [/] a\n  - [ ] todo\n  - [x] done\n- [ ] b\n');
  await page.getByRole('combobox', { name: t.toolbar.filter }).selectOption('in-progress');
  const titles = page.getByRole('textbox', { name: t.item.title });
  await expect(titles).toHaveCount(1);
  const toggle = page.getByRole('checkbox', { name: t.toolbar.subtasks });
  await toggle.check();
  await expect(titles).toHaveCount(3);
  const dimmed = page.locator('.outline-item.is-context > .outline-line');
  await expect(dimmed).toHaveCount(2);
  expect(await dimmed.first().evaluate(node => getComputedStyle(node).opacity)).toBe('0.6');
  await toggle.uncheck();
  await expect(titles).toHaveCount(1);
});
