import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

// Two pages on the same server stand in for two browser tabs editing the same file.
const fields = (page: Page) => page.getByRole('textbox', { name: 'Item text' });
const status = (page: Page) => page.locator('.save-state');

async function openOtherTab(page: Page) {
  const other = await page.context().newPage();
  await other.goto(page.url());
  await expect(fields(other).first()).toBeVisible();
  return other;
}

async function typeAtEnd(page: Page, index: number, text: string) {
  await fields(page).nth(index).click();
  await page.keyboard.press('End');
  await page.keyboard.type(text);
}

test.describe('saving after another tab changed the file', () => {
  test('merges edits to different lines, and both end up on disk', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] top\n- [ ] alpha\n');
    const other = await openOtherTab(page);

    await typeAtEnd(other, 1, ' theirs');
    await expect.poll(outliner.saved).toBe('- [ ] top\n- [ ] alpha theirs\n');
    await typeAtEnd(page, 0, ' mine');

    await expect.poll(outliner.saved).toBe('- [ ] top mine\n- [ ] alpha theirs\n');
    await expect(page.getByRole('status')).toHaveText('Merged external changes into tasks.md. The undo history was cleared.');
    expect(await outliner.titles()).toEqual(['top mine', 'alpha theirs']);
    await expect(fields(page).first()).toBeFocused();
    await expect(status(page)).toHaveText('Saved');
  });

  test('shows the conflicting line when both tabs edit it, and keeps mine on request', async ({ openOutliner, page }) => {
    const outliner = await openOutliner('- [ ] top\n- [ ] alpha\n');
    const other = await openOtherTab(page);

    await typeAtEnd(other, 1, ' theirs');
    await expect.poll(outliner.saved).toBe('- [ ] top\n- [ ] alpha theirs\n');
    await typeAtEnd(page, 1, ' mine');

    const conflict = page.locator('.conflict');
    await expect(conflict.getByText('tasks.md was also changed outside the outliner, and 1 place conflicts with your input.', { exact: false })).toBeVisible();
    await expect(conflict.locator('pre')).toHaveText(['- [ ] alpha mine', '- [ ] alpha theirs']);
    await expect(status(page)).toHaveText('Save conflict in 1 file (input kept)');
    expect(await outliner.saved()).toBe('- [ ] top\n- [ ] alpha theirs\n');

    await conflict.getByRole('button', { name: 'Keep my lines' }).click();
    await expect.poll(outliner.saved).toBe('- [ ] top\n- [ ] alpha mine\n');
    await expect(conflict).toHaveCount(0);
    await expect(status(page)).toHaveText('Saved');
  });
});
