import { expect, t, test } from './fixtures.ts';

test('one-line notes show the first line until the note is clicked, then the whole note', async ({ openOutliner, page }) => {
  await openOutliner('- [ ] a\n  first line of a note\n  second line\n  third line\n');
  const area = page.locator('.note-area');
  const full = (await area.boundingBox())!.height;
  await page.getByRole('checkbox', { name: t.toolbar.oneLineNotes }).check();
  await expect(page.locator('.note-display')).toHaveText('first line of a note…');
  const oneLine = (await area.boundingBox())!.height;
  expect(oneLine).toBeLessThan(full / 2);
  await page.locator('.note-display').click();
  const note = page.getByRole('textbox', { name: t.item.noteLabel });
  await expect(note).toBeFocused();
  await expect(note).toBeVisible();
  expect((await area.boundingBox())!.height).toBeGreaterThan(oneLine * 2);
  await note.blur();
  await expect(page.locator('.note-display')).toHaveText('first line of a note…');
});
