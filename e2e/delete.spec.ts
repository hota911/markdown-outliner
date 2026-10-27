import { expect, t, test } from './fixtures.ts';

test('Ctrl+Shift+Backspace deletes the item with its children and focuses the item above', async ({ openOutliner, page }) => {
  const outliner = await openOutliner('- [ ] A\n- [ ] B\n  - [ ] B1\n- [ ] C\n');
  const titles = page.getByRole('textbox', { name: t.item.title });
  await titles.nth(1).click();
  await page.keyboard.press('Control+Shift+Backspace');
  await expect.poll(outliner.saved).toBe('- [ ] A\n- [ ] C\n');
  await expect(titles).toHaveCount(2);
  await expect(titles.first()).toBeFocused();
  await expect(page.getByRole('status')).toHaveText(t.edit.itemsDeleted(2));
});

test('the selection bar deletes the selected items', async ({ openOutliner, page }) => {
  const outliner = await openOutliner('- [ ] A\n- [ ] B\n- [ ] C\n');
  const handles = page.getByTitle(t.item.dragHandle);
  await handles.nth(0).click();
  await handles.nth(1).click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: t.toolbar.deleteSelection, exact: true }).click();
  await expect.poll(outliner.saved).toBe('- [ ] C\n');
});

test('Backspace or Delete deletes the selected items, but edits the text in a field', async ({ openOutliner, page }) => {
  const outliner = await openOutliner('- [ ] A\n- [ ] B\n- [ ] C\n- [ ] D\n');
  const handles = page.getByTitle(t.item.dragHandle);
  await handles.nth(0).click();
  await handles.nth(1).click({ modifiers: ['Shift'] });
  const titles = page.getByRole('textbox', { name: t.item.title });
  await titles.nth(3).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  await expect.poll(outliner.saved).toBe('- [ ] A\n- [ ] B\n- [ ] C\n- [ ] \n');
  await handles.nth(0).click();
  await handles.nth(1).click({ modifiers: ['Shift'] });
  await page.keyboard.press('Backspace');
  await expect.poll(outliner.saved).toBe('- [ ] C\n- [ ] \n');
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(outliner.titles).toEqual(['A', 'B', 'C', '']);
});
