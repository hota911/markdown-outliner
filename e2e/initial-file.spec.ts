import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { createOutlinerServer } from '../server.mjs';
import { expect, test } from './fixtures.ts';

// A folder without tasks.md: the outliner must not show a file that does not exist.
const files = { 'alpha.md': '- [ ] in alpha\n', 'beta.md': '- [ ] in beta\n' };
const fileSelect = (page: Page) => page.getByRole('combobox', { name: 'File to open' });
const titles = (page: Page) => page.getByRole('textbox', { name: 'Item text' });

let workspace: string;
const servers: Server[] = [];

test.beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-e2e-'));
  for (const [name, text] of Object.entries(files)) await writeFile(path.join(workspace, name), text);
});

test.afterEach(async () => {
  for (const server of servers.splice(0)) await new Promise(resolve => server.close(resolve));
  await rm(workspace, { recursive: true });
});

// Serves a folder or a single file and opens it; server.mjs accepts only the 127.0.0.1 Host header.
async function open(page: Page, target: string) {
  const server = await createOutlinerServer(target);
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
}

test('a folder without tasks.md opens its first file and lists only existing files', async ({ page }) => {
  await open(page, workspace);
  await expect(titles(page)).toHaveValue('in alpha');
  await expect(fileSelect(page)).toHaveValue('alpha.md');
  await expect(fileSelect(page).locator('option')).toHaveText(['alpha.md', 'beta.md']);
});

test('the last file shown is opened again after a reload', async ({ page }) => {
  await open(page, workspace);
  await expect(titles(page)).toHaveValue('in alpha');
  await fileSelect(page).selectOption('beta.md');
  await expect(titles(page)).toHaveValue('in beta');
  await page.reload();
  await expect(titles(page)).toHaveValue('in beta');
  await expect(fileSelect(page)).toHaveValue('beta.md');
});

// The order against the last file shown is covered in test/ui/files.test.js: the web app keeps
// preferences per served path and origin, so a single-file server never sees the folder's last file.
test('a single file given to the server is opened', async ({ page }) => {
  await open(page, path.join(workspace, 'beta.md'));
  await expect(titles(page)).toHaveValue('in beta');
  await expect(fileSelect(page).locator('option')).toHaveText(['beta.md']);
});

test('an empty folder shows that there are no Markdown files', async ({ page }) => {
  for (const name of Object.keys(files)) await rm(path.join(workspace, name));
  await open(page, workspace);
  await expect(page.getByText('There are no Markdown files in this folder.')).toBeVisible();
  await expect(fileSelect(page).locator('option')).toHaveCount(0);
});
