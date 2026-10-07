import { outlineItems } from '../e2e/fixtures.ts';
import { expect, skipReason, test, type Obsidian } from './fixtures.ts';

test.skip(!!skipReason, skipReason ?? '');

const openCommand = 'markdown-outliner:open-outliner';

async function screenshot(obsidian: Obsidian, name: string) {
  await test.info().attach(name, { body: await obsidian.page.screenshot(), contentType: 'image/png' });
}

test('the ribbon icon opens the outliner on tasks.md without console errors', async ({ obsidian }) => {
  const { page } = obsidian;
  await page.getByRole('button', { name: 'Open outliner' }).click();
  await expect(page.getByRole('textbox', { name: 'Item text' }).first()).toHaveValue('週報をまとめる');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  await screenshot(obsidian, 'ribbon');
  expect(obsidian.errors).toEqual([]);
});

test.describe('editing', () => {
  test.use({ vaultFiles: { 'tasks.md': '- [ ] a\n- [ ] b\n- [ ] c\n' } });

  test('a title edit and a status click are saved to the file', async ({ obsidian }) => {
    await obsidian.runCommand(openCommand);
    const items = outlineItems(obsidian.page);
    await expect.poll(items.titles).toEqual(['a', 'b', 'c']);

    await obsidian.page.getByRole('textbox', { name: 'Item text' }).first().fill('a edited');
    await expect.poll(() => obsidian.readFile('tasks.md')).toBe('- [ ] a edited\n- [ ] b\n- [ ] c\n');

    await (await items.line('b')).getByRole('button', { name: 'Not started (click for in progress)' }).click();
    await expect.poll(() => obsidian.readFile('tasks.md')).toBe('- [ ] a edited\n- [/] b\n- [ ] c\n');
  });

  test('dropping an item on the middle of another puts it under that item', async ({ obsidian }) => {
    await obsidian.runCommand(openCommand);
    const items = outlineItems(obsidian.page);
    await expect.poll(items.titles).toEqual(['a', 'b', 'c']);
    await items.drag('c', 'a', { edge: 'child' });
    await expect.poll(() => obsidian.readFile('tasks.md')).toBe('- [ ] a\n  - [ ] c\n- [ ] b\n');
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test(`item text uses the ${scheme} theme colors`, async ({ obsidian }) => {
    await obsidian.setTheme(scheme);
    await obsidian.runCommand(openCommand);
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
  await obsidian.runCommand(openCommand);
  await expect(obsidian.page.getByRole('button', { name: '保存', exact: true })).toBeVisible();
  await expect(obsidian.page.getByRole('button', { name: 'アウトライナーを開く' })).toBeVisible();
  await screenshot(obsidian, 'japanese');
});
