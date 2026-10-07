import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { createOutlinerServer } from '../server.mjs';

export { expect };

/** Reads and drags the items of the outliner on a page. Shared with the Obsidian tests (obsidian-e2e/). */
export interface OutlineItems {
  /** Item titles in screen order. */
  titles: () => Promise<string[]>;
  /** The ⠿ handle of the item with this title. */
  handle: (title: string) => Promise<Locator>;
  /** The line of the item with this title. */
  line: (title: string) => Promise<Locator>;
  /** Drags the item with this title by its handle and drops it on the line of `target`. */
  drag: (title: string, target: string, at: DropPoint) => Promise<void>;
  /** How many lines the title field of the item with this title takes up. */
  titleLines: (title: string) => Promise<number>;
}

export interface Outliner extends OutlineItems {
  /** The Markdown file on disk, as the server saved it. */
  saved: () => Promise<string>;
}

/**
 * Where to release the pointer on the target line. `before` / `after` are the top and bottom
 * edges with the pointer over the title, `child` is the middle of the title, and `outdent`
 * moves the pointer left of the title by this many levels (24px each).
 */
export interface DropPoint {
  edge: 'before' | 'after' | 'child';
  outdent?: number;
}

const itemText = 'Item text';

async function itemLine(page: Page, title: string) {
  const fields = page.getByRole('textbox', { name: itemText });
  const index = (await fields.evaluateAll(nodes => nodes.map(node => (node as HTMLTextAreaElement).value))).indexOf(title);
  if (index < 0) throw new Error(`No item titled ${title}`);
  const field = fields.nth(index);
  return { field, line: field.locator('xpath=ancestor::div[contains(@class, "outline-line")][1]') };
}

/** How far the content of the element is wider than the element, in pixels; 0 or less means no horizontal scrollbar. */
export function horizontalOverflow(locator: Locator) {
  return locator.evaluate(node => node.scrollWidth - node.clientWidth);
}

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  if (!result) throw new Error('Element is not visible');
  return result;
}

// The item labels are English, so the page must show the English UI.
export function outlineItems(page: Page): OutlineItems {
  const handle = async (title: string) => (await itemLine(page, title)).line.getByTitle('Select, or drag to move');
  return {
    titles: () => page.getByRole('textbox', { name: itemText }).evaluateAll(nodes => nodes.map(node => (node as HTMLTextAreaElement).value)),
    handle,
    line: async title => (await itemLine(page, title)).line,
    drag: async (title, target, at) => {
      const source = await box(await handle(title));
      const { field, line } = await itemLine(page, target);
      const lineBox = await box(line);
      const titleLeft = (await box(field)).x;
      const y = lineBox.y + lineBox.height * { before: 0.1, after: 0.9, child: 0.5 }[at.edge];
      const x = titleLeft + 8 - (at.outdent ?? 0) * 24;
      await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
      await page.mouse.down();
      await page.mouse.move(x, y, { steps: 10 });
      await page.mouse.up();
    },
    titleLines: async title => (await itemLine(page, title)).field.evaluate(node => {
      const style = getComputedStyle(node);
      const text = node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      return Math.round(text / parseFloat(style.lineHeight));
    }),
  };
}

export const test = base.extend<{ openOutliner: (markdown: string) => Promise<Outliner> }>({
  openOutliner: async ({ page }, use) => {
    const workspace = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-e2e-'));
    const servers: Server[] = [];
    await use(async markdown => {
      const file = path.join(workspace, 'tasks.md');
      await writeFile(file, markdown);
      const server = await createOutlinerServer(file);
      servers.push(server);
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      // server.mjs accepts only this exact Host header, not localhost.
      await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
      await expect(page.getByRole('textbox', { name: itemText }).first()).toBeVisible();
      return { saved: () => readFile(file, 'utf8'), ...outlineItems(page) };
    });
    for (const server of servers) await new Promise(resolve => server.close(resolve));
    await rm(workspace, { recursive: true });
  },
});
