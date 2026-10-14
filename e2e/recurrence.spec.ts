import { expect, t, test } from './fixtures.ts';

test('completing a recurring task adds its next occurrence above it, and undo removes it', async ({ openOutliner, page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 15, 9, 30));
  const markdown = '- [/] water 🔁 every week on Monday 📅 2026-10-14 [🍅:: 2/3] ^w1\n  - [ ] child\n';
  const outliner = await openOutliner(markdown);
  const line = await outliner.line('water 🔁 every week on Monday 📅 2026-10-14 [🍅:: 2/3] ^w1');
  await line.getByRole('button', { name: t.statusButton('in-progress', 'done') }).click();
  await expect.poll(outliner.titles).toEqual([
    'water 🔁 every week on Monday 📅 2026-10-19 [🍅:: 0/3]',
    'water 🔁 every week on Monday 📅 2026-10-14 [🍅:: 2/3] ✅ 2026-10-15 ^w1',
    'child',
  ]);
  await expect.poll(outliner.saved).toBe('- [ ] water 🔁 every week on Monday 📅 2026-10-19 [🍅:: 0/3]\n'
    + '- [x] water 🔁 every week on Monday 📅 2026-10-14 [🍅:: 2/3] ✅ 2026-10-15 ^w1\n  - [ ] child\n');
  await page.getByRole('button', { name: t.toolbar.undoTitle }).click();
  await expect.poll(outliner.saved).toBe(markdown);
});
