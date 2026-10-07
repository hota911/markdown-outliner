import type { Page } from '@playwright/test';
import { expect, test, type Outliner } from './fixtures.ts';

// A row button that moves between the press and the release of the mouse gets no click. These
// tests press and release once at the center of the button, as a person does, instead of using
// locator.click(), which waits for the button to hold still.

const markdown = '- [ ] a\n  - [ ] a1\n- [ ] b\n';

async function clickOnce(page: Page, outliner: Outliner, title: string, button: string) {
  const line = await outliner.line(title);
  await line.hover();
  const target = line.getByTitle(button, { exact: true });
  await expect(target).toBeVisible();
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

const effects: { button: string; title: string; check: (page: Page, outliner: Outliner) => Promise<void> }[] = [
  {
    button: 'Add a child task',
    title: 'b',
    check: async (_page, outliner) => expect.poll(outliner.titles).toEqual(['a', 'a1', 'b', '']),
  },
  {
    button: 'Edit the note',
    title: 'b',
    check: async page => expect(page.getByRole('textbox', { name: 'Item note' })).toBeVisible(),
  },
  {
    button: 'Zoom into this item',
    title: 'a',
    check: async page => expect(page.getByTitle('Leave the zoomed item')).toBeVisible(),
  },
  {
    button: 'Move the item up',
    title: 'b',
    check: async (_page, outliner) => expect.poll(outliner.saved).toBe('- [ ] b\n- [ ] a\n  - [ ] a1\n'),
  },
  {
    button: 'Move the item down',
    title: 'a',
    check: async (_page, outliner) => expect.poll(outliner.saved).toBe('- [ ] b\n- [ ] a\n  - [ ] a1\n'),
  },
  {
    // The web host opened a single file, so the click only explains why no file was created.
    button: 'Move the item with its children and notes to a new file and embed it',
    title: 'b',
    check: async page => expect(page.getByRole('status')).toHaveText('Cannot create new files when a single file was opened.'),
  },
];

test.describe('a single click on a row button runs it', () => {
  for (const { button, title, check } of effects) {
    test(`${button}, with no title being edited`, async ({ openOutliner, page }) => {
      const outliner = await openOutliner(markdown);
      await clickOnce(page, outliner, title, button);
      await check(page, outliner);
    });

    test(`${button}, while the title of its line is edited`, async ({ openOutliner, page }) => {
      const outliner = await openOutliner(markdown);
      await (await outliner.line(title)).getByRole('textbox', { name: 'Item text' }).click();
      await clickOnce(page, outliner, title, button);
      await check(page, outliner);
    });

    test(`${button}, while the title of another line is edited`, async ({ openOutliner, page }) => {
      const outliner = await openOutliner(markdown);
      // Not the line just above: the buttons of the edited line hang over the next line and cover its own.
      const other = title === 'a' ? 'b' : 'a';
      await (await outliner.line(other)).getByRole('textbox', { name: 'Item text' }).click();
      await clickOnce(page, outliner, title, button);
      await check(page, outliner);
    });
  }
});
