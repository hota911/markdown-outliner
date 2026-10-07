import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { createOutlinerServer } from '../server.mjs';
import { expect, test } from './fixtures.ts';

const menu = (page: Page) => page.getByRole('listbox');
const option = (page: Page, name: string) => menu(page).getByRole('option', { name, exact: true });

test('/done and Enter mark the item done and remove the typed text', async ({ openOutliner, page }) => {
  const outliner = await openOutliner('- [ ] Plan\n');
  const field = page.getByRole('textbox', { name: 'Item text' });
  await field.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' /done');
  await expect(option(page, 'Done')).toBeVisible();
  await expect(field).toHaveAttribute('aria-activedescendant', /.+/);
  await page.keyboard.press('Enter');
  await expect(menu(page)).toBeHidden();
  await expect.poll(outliner.saved).toBe('- [x] Plan\n');
  await expect(field).toHaveValue('Plan');
  await expect(field).toBeFocused();
});

test('Escape closes the menu and keeps the text', async ({ openOutliner, page }) => {
  const outliner = await openOutliner('- [ ] Plan\n');
  const field = page.getByRole('textbox', { name: 'Item text' });
  await field.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' /do');
  await expect(menu(page)).toBeVisible();
  // Auto-save does not close the menu.
  await expect.poll(outliner.saved).toBe('- [ ] Plan /do\n');
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  await expect(field).toHaveValue('Plan /do');
  await expect(field).toBeFocused();
});

test('# lists the tags in use, and Enter inserts the chosen one', async ({ openOutliner, page }) => {
  const outliner = await openOutliner('- [ ] Trip #travel\n- [ ] Read #reading\n- [ ] Plan\n');
  const field = page.getByRole('textbox', { name: 'Item text' }).nth(2);
  await field.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' #');
  await expect(menu(page).getByRole('option')).toHaveText(['#reading', '#travel']);
  await page.keyboard.type('tr');
  await expect(menu(page).getByRole('option')).toHaveText(['#travel']);
  await page.keyboard.press('Enter');
  await expect(menu(page)).toBeHidden();
  await page.keyboard.type('x');
  await expect(field).toHaveValue('Plan #travel x');
  await expect.poll(outliner.saved).toBe('- [ ] Trip #travel\n- [ ] Read #reading\n- [ ] Plan #travel x\n');
});

test.describe('embedding a file', () => {
  let workspace: string;
  const servers: Server[] = [];

  test.beforeEach(async () => {
    workspace = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-e2e-'));
    await mkdir(path.join(workspace, 'notes'));
    await writeFile(path.join(workspace, 'inbox.md'), '- [ ] Plan\n');
    await writeFile(path.join(workspace, 'notes', 'work.md'), '- [ ] Work task\n');
  });

  test.afterEach(async () => {
    for (const server of servers.splice(0)) await new Promise(resolve => server.close(resolve));
    await rm(workspace, { recursive: true });
  });

  test('/ then the embed command and a file insert the embed, which renders the file', async ({ page }) => {
    const server = await createOutlinerServer(workspace);
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    // server.mjs accepts only the 127.0.0.1 Host header.
    await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
    const field = page.getByRole('textbox', { name: 'Item text' });
    await expect(field).toHaveValue('Plan');
    await field.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' /');
    await option(page, 'Embed existing file').click();
    await expect(option(page, 'notes/work.md')).toBeVisible();
    await expect(option(page, 'inbox.md')).toHaveCount(0);
    await option(page, 'notes/work.md').click();
    await expect(page.getByText('File: notes/work.md')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Item text' }).nth(1)).toHaveValue('Work task');
    await expect.poll(() => readFile(path.join(workspace, 'inbox.md'), 'utf8')).toBe('- [ ] Plan\n- ![[notes/work.md]]\n');
  });
});
