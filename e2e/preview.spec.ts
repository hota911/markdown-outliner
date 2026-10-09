import { readdir } from 'node:fs/promises';
import { expect, test } from './fixtures.ts';

// The preview build (`npm run build:preview`): one HTML file, opened directly from disk as a
// downloaded pull request artifact would be.
const previewDirectory = new URL('../dist/preview/', import.meta.url);
const previewPage = new URL('markdown-outliner-preview.html', previewDirectory);

test('the preview build is a single file', async () => {
  expect(await readdir(previewDirectory)).toEqual(['markdown-outliner-preview.html']);
});

test('the preview opens the samples from file://, saves an edit in memory, and starts over on reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Anything the page loads besides itself would be missing from the single file.
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  const first = page.getByRole('textbox', { name: 'Item text' }).first();
  const fileSelect = page.getByRole('combobox', { name: 'File to open' });

  await page.goto(previewPage.href);
  await expect(fileSelect.locator('option')).toHaveText(['tasks.md', 'work.md']);
  await expect(first).toHaveValue(/週報をまとめる/);
  const original = await first.inputValue();

  await first.fill('Edited in the preview');
  await first.press('Escape');
  // The edit is saved to the in-memory adapter after a short delay (scheduleSave in the controller).
  await expect(page.getByText(/unsaved/)).toBeVisible();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await expect(first).toHaveValue('Edited in the preview');

  await page.reload();
  await expect(first).toHaveValue(original);
  expect(errors).toEqual([]);
  expect(new Set(requests)).toEqual(new Set([previewPage.href]));
});
