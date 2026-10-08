import http, { type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures.ts';

// The static preview build (`npm run build:preview`), served as plain files as a static host would.
const previewRoot = fileURLToPath(new URL('../dist/preview/', import.meta.url));
const contentTypes: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

let server: Server;
let url: string;

test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    // Served under /preview/ to check that the build works away from the site root.
    const pathname = new URL(request.url!, 'http://localhost').pathname.replace(/^\/preview\//, '');
    const file = path.join(previewRoot, pathname === '' ? 'index.html' : pathname);
    const served = request.url!.startsWith('/preview/') ? readFile(file) : Promise.reject(new Error('Outside /preview/'));
    served.then(content => {
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)] ?? 'application/octet-stream' });
      response.end(content);
    }, () => { response.writeHead(404); response.end(); });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/preview/`;
});

test.afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('the preview opens the samples, saves an edit in memory, and starts over on reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const first = page.getByRole('textbox', { name: 'Item text' }).first();
  const fileSelect = page.getByRole('combobox', { name: 'File to open' });

  await page.goto(url);
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
});
