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

test('a bookmark keeps whether notes show one line', async ({ openOutliner, page }) => {
  await openOutliner('- [ ] a\n  first\n  second\n');
  const toggle = page.getByRole('checkbox', { name: t.toolbar.oneLineNotes });
  await toggle.check();
  const sidebar = page.getByRole('complementary', { name: t.bookmarks.heading });
  await sidebar.getByRole('button', { name: t.bookmarks.addView }).click();
  await toggle.uncheck();
  await expect(page.locator('.note-display')).toHaveCount(0);
  await sidebar.getByRole('button', { name: /^\S+\.md \(one-line notes\)$/ }).click();
  await expect(toggle).toBeChecked();
  await expect(page.locator('.note-display')).toHaveText('first…');
});
