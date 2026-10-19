import { expect, t, test } from './fixtures.ts';

test('on macOS, Ctrl+N / Ctrl+P move between items as ↓↑ do', async ({ openOutliner, page }) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }));
  await openOutliner('- [ ] a\n- [ ] b\n- [ ] c\n');
  const titles = page.getByRole('textbox', { name: t.item.title });
  await titles.nth(0).click();
  await page.keyboard.press('Control+n');
  await page.keyboard.press('Control+n');
  await expect(titles.nth(2)).toBeFocused();
  await page.keyboard.press('Control+p');
  await expect(titles.nth(1)).toBeFocused();
});
