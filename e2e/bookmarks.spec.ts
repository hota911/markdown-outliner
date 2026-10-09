import type { Locator, Page } from '@playwright/test';
import { expect, horizontalOverflow, t, test } from './fixtures.ts';

const longWord = 'projects/very-long-directory-name/another-very-long-directory-name/tasks-with-a-very-long-file-name.md';
const longJapanese = '来週の定例に向けて打ち合わせの資料と議題を準備して関係者に共有するためのブックマーク';

const sidebar = (page: Page) => page.getByRole('complementary', { name: t.bookmarks.heading });
const rect = (locator: Locator) => locator.evaluate(node => node.getBoundingClientRect().toJSON() as DOMRect);

// Obsidian's own stylesheet gives every button a fixed height and centers its content in a flex box;
// the web version has no such rule, so the tests add it to check that the sidebar overrides it.
const hostButtonStyle = 'button { display: inline-flex; align-items: center; justify-content: center; height: 30px; }';

async function addBookmarkNamed(page: Page, name: string) {
  await sidebar(page).getByRole('button', { name: t.bookmarks.addView }).click();
  const item = sidebar(page).getByRole('listitem').first();
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: /^Rename / }).click();
  const field = item.getByRole('textbox', { name: t.bookmarks.nameInput });
  await field.fill(name);
  await field.press('Enter');
  await expect(item.getByRole('button', { name, exact: true })).toBeVisible();
}

/** Fails when the page or the sidebar scrolls sideways, or an element of the sidebar sticks out of it. */
async function expectNoOverflow(page: Page) {
  expect(await horizontalOverflow(page.locator('html'))).toBeLessThanOrEqual(0);
  expect(await horizontalOverflow(sidebar(page))).toBeLessThanOrEqual(0);
  const bounds = await rect(sidebar(page));
  for (const element of await sidebar(page).locator('button, input, p').all()) {
    const description = await element.evaluate(node => node.outerHTML.slice(0, 80));
    // A text field scrolls its own text, so only its box has to fit.
    if (await element.evaluate(node => node.tagName !== 'INPUT')) {
      expect(await horizontalOverflow(element), description).toBeLessThanOrEqual(0);
      expect(await element.evaluate(node => node.scrollHeight - node.clientHeight), description).toBeLessThanOrEqual(0);
    }
    const box = await rect(element);
    expect(box.left, description).toBeGreaterThanOrEqual(bounds.left - 0.5);
    expect(box.right, description).toBeLessThanOrEqual(bounds.right + 0.5);
  }
}

for (const width of [1280, 375]) {
  for (const longName of [longWord, longJapanese]) {
    test(`at ${width}px the long bookmark name "${longName.slice(0, 12)}…" wraps inside the sidebar and its buttons stay in line`, async ({ openOutliner, page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openOutliner('- [ ] a\n');
      await page.addStyleTag({ content: hostButtonStyle });
      await expectNoOverflow(page);
      await addBookmarkNamed(page, longName);
      await expectNoOverflow(page);

      // The whole name shows over several lines, with the buttons beside it.
      const item = sidebar(page).getByRole('listitem').first();
      const name = item.getByRole('button', { name: longName, exact: true });
      const nameBox = await rect(name);
      expect(nameBox.height).toBeGreaterThan(30);
      for (const button of [item.getByRole('button', { name: t.bookmarks.rename(longName) }), item.getByRole('button', { name: t.bookmarks.remove(longName) })]) {
        await expect(button).toBeVisible();
        const box = await rect(button);
        expect(box.left).toBeGreaterThanOrEqual(nameBox.right - 0.5);
        expect(box.top).toBeGreaterThanOrEqual(nameBox.top - 0.5);
        expect(box.bottom).toBeLessThanOrEqual(nameBox.bottom + 0.5);
      }

      // The rename field stays inside the sidebar too.
      await item.getByRole('button', { name: t.bookmarks.rename(longName) }).click();
      await expect(item.getByRole('textbox', { name: t.bookmarks.nameInput })).toBeFocused();
      await expectNoOverflow(page);
    });
  }

  test(`at ${width}px the bookmarks and the outline scroll separately`, async ({ openOutliner, page }) => {
    await page.setViewportSize({ width, height: 800 });
    const items = Array.from({ length: 80 }, (_, index) => `- [ ] item ${index}\n`).join('');
    await openOutliner(items);
    await addBookmarkNamed(page, 'Bookmark 0');
    // Copy the stored bookmark into many, then load them.
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        const preferences = JSON.parse(localStorage.getItem(key)!) as { bookmarks?: { id: string; name: string }[] };
        if (!preferences.bookmarks?.length) continue;
        const [first] = preferences.bookmarks;
        preferences.bookmarks = Array.from({ length: 40 }, (_, index) => ({ ...first, id: `${first.id}-${index}`, name: `Bookmark ${index}` }));
        localStorage.setItem(key, JSON.stringify(preferences));
      }
    });
    await page.reload();
    await expect(sidebar(page).getByRole('button', { name: 'Bookmark 39', exact: true })).toBeAttached();

    const pageScroll = () => page.evaluate(() => window.scrollY);
    const sidebarScroll = () => sidebar(page).evaluate(node => node.scrollTop);
    const viewport = page.viewportSize()!;
    // The list is taller than the sidebar, which fits in the view.
    expect(await sidebar(page).evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
    expect((await rect(sidebar(page))).height).toBeLessThanOrEqual(viewport.height);

    // Scrolling the bookmarks leaves the outline where it is.
    const sidebarBox = await rect(sidebar(page));
    await page.mouse.move(sidebarBox.left + sidebarBox.width / 2, sidebarBox.top + sidebarBox.height / 2);
    await page.mouse.wheel(0, 5000);
    await expect.poll(sidebarScroll).toBeGreaterThan(0);
    await page.waitForTimeout(300);
    expect(await pageScroll()).toBe(0);

    // Scrolling the outline leaves the bookmarks where they are.
    const scrolledSidebar = await sidebarScroll();
    const line = await rect(page.getByRole('textbox', { name: t.item.title }).nth(40));
    await page.mouse.move(line.left + 10, Math.min(line.top, viewport.height - 20));
    await page.mouse.wheel(0, 1500);
    await expect.poll(pageScroll).toBeGreaterThan(0);
    expect(await sidebarScroll()).toBe(scrolledSidebar);
    // Side by side, the sidebar stays in the view; on a phone it sits above the outline and scrolls away with it.
    if (width > 600) expect((await rect(sidebar(page))).top).toBeGreaterThanOrEqual(-0.5);
    await expectNoOverflow(page);
  });
}
