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
    await page.locator('.workspace-leaf.mod-active .view-action[aria-label="More options"]').click();
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

test.describe('bookmarks', () => {
  const longName = 'projects/very-long-directory-name/another-very-long-directory-name/tasks-with-a-very-long-file-name.md';
  const bookmarks = Array.from({ length: 40 }, (_, index) => ({
    id: `bookmark-${index}`, kind: 'view', file: 'tasks.md', status: 'all', tags: [], name: index === 0 ? longName : `Bookmark ${index}`,
  }));
  test.use({
    vaultFiles: {
      'tasks.md': Array.from({ length: 80 }, (_, index) => `- [ ] item ${index}\n`).join(''),
      '.obsidian/plugins/markdown-outliner/data.json': JSON.stringify({ bookmarks }),
    },
  });

  test('a long name wraps, and the sidebar and the outline scroll separately', async ({ obsidian }) => {
    const { page } = obsidian;
    await obsidian.runCommand(openOutliner);
    const view = page.locator('.markdown-outliner-container');
    const sidebar = page.getByRole('complementary', { name: 'Bookmarks' });
    await expect(sidebar.getByRole('button', { name: longName, exact: true })).toBeVisible();
    expect(await horizontalOverflow(view)).toBeLessThanOrEqual(0);
    expect(await horizontalOverflow(sidebar)).toBeLessThanOrEqual(0);
    // Obsidian gives buttons a fixed height; the wrapped name must not spill out of its button.
    expect(await sidebar.getByRole('button', { name: longName, exact: true }).evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(0);

    // The sidebar fits in the view and scrolls its own list.
    const viewBox = (await view.boundingBox())!;
    const sidebarBox = (await sidebar.boundingBox())!;
    expect(await sidebar.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
    expect(sidebarBox.y + sidebarBox.height).toBeLessThanOrEqual(viewBox.y + viewBox.height + 0.5);
    await screenshot(obsidian, 'bookmarks');

    const viewScroll = () => view.evaluate(node => node.scrollTop);
    const sidebarScroll = () => sidebar.evaluate(node => node.scrollTop);
    await page.mouse.move(sidebarBox.x + sidebarBox.width / 2, sidebarBox.y + sidebarBox.height / 2);
    await page.mouse.wheel(0, 5000);
    await expect.poll(sidebarScroll).toBeGreaterThan(0);
    await page.waitForTimeout(300);
    expect(await viewScroll()).toBe(0);

    const scrolledSidebar = await sidebarScroll();
    await page.mouse.move(viewBox.x + viewBox.width / 2, viewBox.y + viewBox.height / 2);
    await page.mouse.wheel(0, 1500);
    await expect.poll(viewScroll).toBeGreaterThan(0);
    expect(await sidebarScroll()).toBe(scrolledSidebar);
    expect((await sidebar.boundingBox())!.y).toBeGreaterThanOrEqual(viewBox.y - 0.5);
    await screenshot(obsidian, 'bookmarks-scrolled');
  });
});
