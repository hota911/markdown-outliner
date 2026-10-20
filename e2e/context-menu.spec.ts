import { expect, t, test } from './fixtures.ts';

test('a right-click on the handle opens the / commands; the text keeps the native menu', async ({ openOutliner, page }) => {
  const outliner = await openOutliner('- [ ] A\n- [ ] B\n  - [ ] B1\n');
  const menu = page.getByRole('menu', { name: t.slash.commands });
  await page.getByRole('textbox', { name: t.item.title }).first().click({ button: 'right' });
  await expect(menu).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByTitle(t.item.dragHandle).nth(1).click({ button: 'right' });
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await menu.getByRole('menuitem', { name: t.slash.command.delete.label }).click();
  await expect.poll(outliner.saved).toBe('- [ ] A\n');
  await expect(menu).toHaveCount(0);
});
