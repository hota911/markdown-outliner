import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const fields = (page: Page) => page.getByRole('textbox', { name: 'Item text' });

// Records the elements whose Svelte intro starts. `introstart` does not bubble, so the listener captures.
async function recordIntros(page: Page) {
  await page.addInitScript(() => {
    const intros: string[] = [];
    (window as unknown as { intros: string[] }).intros = intros;
    document.addEventListener('introstart', event => intros.push((event.target as Element).className), true);
  });
  return () => page.evaluate(() => (window as unknown as { intros: string[] }).intros.filter(name => name.includes('outline-item')).length);
}

test.describe('with motion', () => {
  test('a new item animates in, and has the focus at once so typing goes into it', async ({ openOutliner, page }) => {
    const intros = await recordIntros(page);
    const outliner = await openOutliner('- [ ] first\n- [ ] second\n');
    // Neither loading the page nor zooming in and out animates the items already there.
    // With the title focused the row buttons already hang below it and stay put when one is pressed.
    await fields(page).first().click();
    await page.getByTitle('Zoom into this item').first().click();
    await page.getByTitle('Leave the zoomed item').click();
    await expect.poll(outliner.titles).toEqual(['first', 'second']);
    // An intro would have started within this time; the transitions take 150ms.
    await page.waitForTimeout(300);
    expect(await intros()).toBe(0);

    await fields(page).first().click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    // Read right after the key press, without waiting: the focus must not wait for the animation.
    expect(await page.evaluate(() => {
      const node = document.activeElement as HTMLTextAreaElement;
      return { field: node.dataset.field, value: node.value };
    })).toEqual({ field: 'title', value: '' });
    await expect.poll(intros).toBe(1);
    await page.keyboard.type('new');
    await expect.poll(outliner.saved).toBe('- [ ] first\n- [ ] new\n- [ ] second\n');
  });

  test('the sidebar changes its width with a transition', async ({ openOutliner, page }) => {
    await openOutliner('- [ ] first\n');
    const sidebar = page.getByRole('complementary');
    await sidebar.evaluate(node => node.addEventListener('transitionrun', () => node.setAttribute('data-ran', 'true')));
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(sidebar).toHaveAttribute('data-ran', 'true');
    await expect.poll(() => sidebar.evaluate(node => node.getBoundingClientRect().width)).toBe(24);
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Add current view' })).toBeVisible();
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a new item and the sidebar change without animation', async ({ openOutliner, page }) => {
    await openOutliner('- [ ] first\n');
    await fields(page).first().click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => {
      const node = document.activeElement as HTMLTextAreaElement;
      return { field: node.dataset.field, running: node.closest('.outline-item')!.getAnimations().filter(animation => animation.playState === 'running').length };
    })).toEqual({ field: 'title', running: 0 });
    expect(await page.getByRole('complementary').evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
  });
});
