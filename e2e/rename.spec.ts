import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { createOutlinerServer } from '../server.mjs';
import { expect, test } from './fixtures.ts';

let workspace: string;
let server: Server;

test.beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-e2e-rename-'));
  await mkdir(path.join(workspace, 'sub'));
  await writeFile(path.join(workspace, 'index.md'), '- [ ] host\n- ![[sub/work.md]]\n');
  await writeFile(path.join(workspace, 'sub', 'work.md'), '- [ ] job\n');
  await writeFile(path.join(workspace, 'sub', 'taken.md'), 'keep\n');
});

test.afterEach(async () => {
  await new Promise(resolve => server.close(resolve));
  await rm(workspace, { recursive: true });
});

// index.md sorts first, so the folder opens on it. server.mjs accepts only the 127.0.0.1 Host header.
async function open(page: Page) {
  server = await createOutlinerServer(workspace);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
  await expect(page.getByRole('textbox', { name: 'Item text' }).nth(1)).toHaveValue('job');
}

const nameInput = (page: Page) => page.getByRole('textbox', { name: 'New name of the embedded file, without .md' });

test('renames the embedded file on disk and updates the embed line', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Rename' }).click();
  await expect(nameInput(page)).toHaveValue('work');
  await nameInput(page).fill('done jobs');
  await nameInput(page).press('Enter');
  await expect(page.getByText('Renamed the file to done jobs.md.')).toBeVisible();
  await expect.poll(() => readFile(path.join(workspace, 'index.md'), 'utf8')).toBe('- [ ] host\n- ![[sub/done jobs.md]]\n');
  expect((await readdir(path.join(workspace, 'sub'))).sort()).toEqual(['done jobs.md', 'taken.md']);
  expect(await readFile(path.join(workspace, 'sub', 'done jobs.md'), 'utf8')).toBe('- [ ] job\n');
  await expect(page.getByRole('combobox', { name: 'File to open' }).locator('option')).toHaveText(['index.md', 'sub/done jobs.md', 'sub/taken.md']);
});

test('an existing name is refused and Escape cancels, leaving the files unchanged', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Rename' }).click();
  await nameInput(page).fill('taken');
  await nameInput(page).press('Enter');
  await expect(page.getByText('Could not rename the file:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Rename' }).click();
  await nameInput(page).fill('other');
  await nameInput(page).press('Escape');
  await expect(nameInput(page)).toHaveCount(0);
  expect((await readdir(path.join(workspace, 'sub'))).sort()).toEqual(['taken.md', 'work.md']);
  expect(await readFile(path.join(workspace, 'index.md'), 'utf8')).toBe('- [ ] host\n- ![[sub/work.md]]\n');
});
