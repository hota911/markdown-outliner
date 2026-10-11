import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { createOutlinerServer } from '../server.mjs';
import { closeServer, expect, t, test } from './fixtures.ts';

let workspace: string;
let server: Server;

test.beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-e2e-trash-'));
  await mkdir(path.join(workspace, 'sub'));
  await writeFile(path.join(workspace, 'index.md'), '- [ ] host\n- ![[sub/work.md]]\n');
  await writeFile(path.join(workspace, 'sub', 'work.md'), '- [ ] job\n');
});

test.afterEach(async () => {
  await closeServer(server);
  await rm(workspace, { recursive: true });
});

// index.md sorts first, so the folder opens on it. server.mjs accepts only the 127.0.0.1 Host header.
async function open(page: Page) {
  server = await createOutlinerServer(workspace);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
  await expect(page.getByRole('textbox', { name: t.item.title }).nth(1)).toHaveValue('job');
}

const deleteButton = (page: Page) => page.getByRole('button', { name: t.outline.delete, exact: true });

test('moves the embedded file into .trash after confirmation and removes the embed line', async ({ page }) => {
  await open(page);
  await deleteButton(page).click();
  await expect(page.getByText(t.outline.deleteConfirm('sub/work.md'))).toBeVisible();
  await expect(page.getByRole('button', { name: t.outline.deleteCancel })).toBeFocused();
  await page.getByRole('button', { name: t.outline.deleteConfirmButton }).click();
  await expect(page.getByText(t.edit.deleted('work.md'))).toBeVisible();
  await expect.poll(() => readFile(path.join(workspace, 'index.md'), 'utf8')).toBe('- [ ] host\n');
  expect(await readdir(path.join(workspace, 'sub'))).toEqual([]);
  expect(await readFile(path.join(workspace, '.trash', 'work.md'), 'utf8')).toBe('- [ ] job\n');
  await expect(page.getByRole('combobox', { name: t.toolbar.fileSelect }).locator('option')).toHaveText(['index.md']);
});

test('Cancel and a file embedded elsewhere leave the files unchanged', async ({ page }) => {
  await writeFile(path.join(workspace, 'index.md'), '- [ ] host\n- ![[sub/work.md]]\n- ![[sub/work]]\n');
  await open(page);
  await deleteButton(page).first().click();
  await page.getByRole('button', { name: t.outline.deleteCancel }).click();
  await expect(page.getByRole('button', { name: t.outline.deleteConfirmButton })).toHaveCount(0);
  await deleteButton(page).first().click();
  await page.getByRole('button', { name: t.outline.deleteConfirmButton }).click();
  await expect(page.getByText(t.edit.deleteEmbeddedElsewhere('work.md'))).toBeVisible();
  expect(await readdir(path.join(workspace, 'sub'))).toEqual(['work.md']);
  expect(await readFile(path.join(workspace, 'index.md'), 'utf8')).toBe('- [ ] host\n- ![[sub/work.md]]\n- ![[sub/work]]\n');
  await expect(readdir(path.join(workspace, '.trash'))).rejects.toThrow();
});
