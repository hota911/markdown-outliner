import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { createOutlinerServer } from '../server.mjs';
import { closeServer, expect, t, test } from './fixtures.ts';

let workspace: string;
let server: Server;

test.beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-e2e-links-'));
  await mkdir(path.join(workspace, 'notes'));
  await writeFile(path.join(workspace, 'index.md'), '- [ ] read [plan](notes/my%20plan.md#Goals) now\n  see [data](<notes/table one.txt>)\n');
  await writeFile(path.join(workspace, 'notes', 'my plan.md'), '- [ ] goal [back](../index.md)\n');
  await writeFile(path.join(workspace, 'notes', 'table one.txt'), 'linked text\n');
});

test.afterEach(async () => {
  await closeServer(server);
  await rm(workspace, { recursive: true });
});

const fileSelect = (page: Page) => page.getByRole('combobox', { name: t.toolbar.fileSelect });
const firstTitle = (page: Page) => page.getByRole('textbox', { name: t.item.title }).first();

// index.md sorts first, so the folder opens on it. server.mjs accepts only the 127.0.0.1 Host header.
async function open(page: Page) {
  server = await createOutlinerServer(workspace);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
  await expect(firstTitle(page)).toHaveValue('read [plan](notes/my%20plan.md#Goals) now');
}

test('a link to a Markdown file opens it in the outliner, relative to the file containing it', async ({ page }) => {
  await open(page);
  await page.locator('.title-display a').click();
  await expect(fileSelect(page)).toHaveValue('notes/my plan.md');
  await expect(firstTitle(page)).toHaveValue('goal [back](../index.md)');
  await page.locator('.title-display a').click();
  await expect(fileSelect(page)).toHaveValue('index.md');
});

test('a link to another file opens it from the server in a new tab', async ({ page }) => {
  await open(page);
  const popup = page.waitForEvent('popup');
  await page.locator('.note-display a').click();
  const tab = await popup;
  await expect(tab.locator('body')).toHaveText('linked text');
  await expect(fileSelect(page)).toHaveValue('index.md');
});

test('while editing, only ⌘/Ctrl-click follows a link', async ({ page }) => {
  await open(page);
  const box = (await page.locator('.title-display a').boundingBox())!;
  await page.locator('.title-display span').first().click({ position: { x: 1, y: 5 } });
  await expect(firstTitle(page)).toBeFocused();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(firstTitle(page)).toBeFocused();
  await expect(fileSelect(page)).toHaveValue('index.md');
  await page.keyboard.down('ControlOrMeta');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.up('ControlOrMeta');
  await expect(fileSelect(page)).toHaveValue('notes/my plan.md');
});
