import { horizontalOverflow, outlineItems } from '../e2e/fixtures.ts';
import { expect, skipReason, test, type Obsidian } from './fixtures.ts';

test.skip(!!skipReason, skipReason ?? '');

const openOutliner = 'markdown-outliner:open-outliner';
const openFileAsOutline = 'markdown-outliner:open-file-as-outline';
const fileViewType = 'markdown-outliner-file';

// Saved under test-results/ for a visual check of the theme and layout.
async function screenshot(obsidian: Obsidian, name: string) {
  await obsidian.page.screenshot({ path: test.info().outputPath(`${name}.png`) });
}

test('the ribbon icon opens the outliner on tasks.md without console errors', async ({ obsidian }) => {
  const { page } = obsidian;
  // Ribbon icons are labelled divs, not buttons.
  await page.getByLabel('Open outliner', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Item text' }).first()).toHaveValue('週報をまとめる #work #priority/high');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  await screenshot(obsidian, 'ribbon');
  expect(obsidian.errors).toEqual([]);
});

test.describe('editing', () => {
  test.use({ vaultFiles: { 'tasks.md': '- [ ] a\n- [ ] b\n- [ ] c\n' } });

  test('a title edit and a status click are saved to the file', async ({ obsidian }) => {
    await obsidian.runCommand(openOutliner);
    const items = outlineItems(obsidian.page);
    await expect.poll(items.titles).toEqual(['a', 'b', 'c']);

    await obsidian.page.getByRole('textbox', { name: 'Item text' }).first().fill('a edited');
    await expect.poll(() => obsidian.readFile('tasks.md')).toBe('- [ ] a edited\n- [ ] b\n- [ ] c\n');

    await (await items.line('b')).getByRole('button', { name: 'Not started (click for in progress)' }).click();
    await expect.poll(() => obsidian.readFile('tasks.md')).toBe('- [ ] a edited\n- [/] b\n- [ ] c\n');
  });

  test('dropping an item on the middle of another puts it under that item', async ({ obsidian }) => {
    await obsidian.runCommand(openOutliner);
    const items = outlineItems(obsidian.page);
    await expect.poll(items.titles).toEqual(['a', 'b', 'c']);
    await items.drag('c', 'a', { edge: 'child' });
    await expect.poll(() => obsidian.readFile('tasks.md')).toBe('- [ ] a\n  - [ ] c\n- [ ] b\n');
  });
});

test.describe('a file opened as an outline in its own tab', () => {
  test.use({ vaultFiles: { 'notes/plan.md': '- [ ] x\n- [ ] y\n' } });

  test('replaces the Markdown editor, saves edits, and switches back with "Open as Markdown"', async ({ obsidian }) => {
    const { page } = obsidian;
    await obsidian.openFile('notes/plan.md');
    expect(await obsidian.activeView()).toMatchObject({ type: 'markdown', file: 'notes/plan.md' });

    await obsidian.runCommand(openFileAsOutline);
    expect(await obsidian.activeView()).toEqual({ type: fileViewType, file: 'notes/plan.md', title: 'plan' });
    await expect(page.locator('.workspace-tab-header.mod-active')).toHaveText('plan');
    const items = outlineItems(page);
    await expect.poll(items.titles).toEqual(['x', 'y']);
    await screenshot(obsidian, 'file-view');

    await page.getByRole('textbox', { name: 'Item text' }).first().fill('x edited');
    await expect.poll(() => obsidian.readFile('notes/plan.md')).toBe('- [ ] x edited\n- [ ] y\n');

    // The tab's "More options" menu offers "Open as Markdown".
    // DEBUG (temporary)
    await page.evaluate(() => {
      const w = window as any;
      w.__log = [];
      const t0 = performance.now();
      const log = (m: string) => w.__log.push(`${Math.round(performance.now() - t0)} ${m}`);
      new MutationObserver(records => { for (const r of records) { for (const n of r.addedNodes) if ((n as Element).classList?.contains('menu')) log('menu added: ' + n.textContent); for (const n of r.removedNodes) if ((n as Element).classList?.contains('menu')) log('menu removed'); } }).observe(document.body, { childList: true });
      for (const type of ['mousedown', 'mouseup', 'click', 'blur', 'focus']) window.addEventListener(type, e => log(`${type} ${(e.target as Element)?.className ?? ''}`), true);
      log('hasFocus ' + document.hasFocus() + ' active ' + document.activeElement?.className);
    });
    const probe = () => page.evaluate(() => { const w = window as any; return JSON.stringify({ aw: typeof w.activeWindow, same: w.activeWindow === window, ad: w.activeDocument === document, awHref: String(w.activeWindow?.location?.href), awBody: w.activeDocument?.body?.children?.length, focused: w.require('@electron/remote').getCurrentWindow().isFocused(), wins: w.require('@electron/remote').BrowserWindow.getAllWindows().map((b: any) => [b.id, b.isVisible(), b.webContents.getURL()]) }); });
    console.log('DEBUG0', await probe());
    await page.evaluate(() => (window as any).require('@electron/remote').getCurrentWindow().focus());
    await page.waitForTimeout(500);
    console.log('DEBUG0b', await probe());
    await page.locator('.workspace-leaf.mod-active .view-action[aria-label="More options"]').click();
    await page.waitForTimeout(1000);
    console.log('DEBUG1', await page.evaluate(() => JSON.stringify((window as any).__log)), await page.locator('.menu').count());
    await page.locator('.workspace-leaf.mod-active .view-action[aria-label="More options"]').click();
    await page.waitForTimeout(1000);
    console.log('DEBUG2', await page.evaluate(() => JSON.stringify({ log: (window as any).__log, menuish: [...document.querySelectorAll('[class*="menu"]')].map(e => e.tagName + '.' + e.className).slice(0, 40), body: [...document.body.children].map(e => e.tagName + '.' + e.className), docs: (window as any).activeWindow === window, popouts: (window as any).app.workspace.floatingSplit?.children?.length })));
    await page.screenshot({ path: 'test-results/debug-menu.png' });
    await page.locator('.menu-item').filter({ hasText: 'Open as Markdown' }).click();
    expect(await obsidian.activeView()).toMatchObject({ type: 'markdown', file: 'notes/plan.md' });
    expect(obsidian.errors).toEqual([]);
  });

  test('is restored after Obsidian restarts', async ({ obsidian }) => {
    await obsidian.openFile('notes/plan.md');
    await obsidian.runCommand(openFileAsOutline);
    await obsidian.relaunch();
    expect(await obsidian.activeView()).toEqual({ type: fileViewType, file: 'notes/plan.md', title: 'plan' });
    await expect.poll(outlineItems(obsidian.page).titles).toEqual(['x', 'y']);
    await screenshot(obsidian, 'file-view-restored');
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test(`item text uses the ${scheme} theme colors`, async ({ obsidian }) => {
    await obsidian.setTheme(scheme);
    await obsidian.runCommand(openOutliner);
    const title = obsidian.page.getByRole('textbox', { name: 'Item text' }).first();
    await expect(title).toBeVisible();
    // The plugin styles use Obsidian's theme variables, so item text has the same color as
    // Obsidian's own text (body is var(--text-normal)) instead of a fixed one.
    await expect(title).toHaveCSS('color', await obsidian.page.evaluate(() => getComputedStyle(document.body).color));
    await screenshot(obsidian, scheme);
  });
}

test('with the Japanese interface language the plugin shows Japanese labels', async ({ obsidian }) => {
  await obsidian.setLanguage('ja');
  await expect(obsidian.page.getByLabel('アウトライナーを開く', { exact: true })).toBeVisible();
  await obsidian.runCommand(openOutliner);
  await expect(obsidian.page.getByRole('button', { name: '保存', exact: true })).toBeVisible();
  await screenshot(obsidian, 'japanese');
});

test('item titles use the width of the tab, without a horizontal scrollbar', async ({ obsidian }) => {
  const { page } = obsidian;
  await obsidian.runCommand(openOutliner);
  const items = outlineItems(page);
  await expect.poll(items.titles).toContain('家の片付けをする #home');
  await screenshot(obsidian, 'wrap');
  expect(await items.titleLines('家の片付けをする #home')).toBe(1);
  expect(await items.titleLines('週報をまとめる #work #priority/high')).toBe(1);
  expect(await horizontalOverflow(page.locator('.markdown-outliner-container'))).toBeLessThanOrEqual(0);
});
