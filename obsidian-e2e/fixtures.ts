import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, test as base, expect, type Page } from '@playwright/test';

export { expect };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginId = 'markdown-outliner';

/** The Obsidian.app bundle to test against: OBSIDIAN_APP, or the default install location. */
export const obsidianApp = process.env.OBSIDIAN_APP || '/Applications/Obsidian.app';
const executable = path.join(obsidianApp, 'Contents', 'MacOS', 'Obsidian');
export const skipReason = process.platform !== 'darwin'
  ? 'The Obsidian tests run only on macOS.'
  : existsSync(executable) ? null : `Obsidian not found at ${obsidianApp}; set OBSIDIAN_APP to the Obsidian.app bundle.`;

export interface Obsidian {
  /** The window of the running Obsidian; a new page after relaunch(). */
  readonly page: Page;
  /** Console errors and uncaught exceptions of the window since the last launch. */
  readonly errors: string[];
  /** Reads a file of the vault from disk. */
  readFile: (relative: string) => Promise<string>;
  /** Runs a command by id, such as `markdown-outliner:open-outliner`. Fails if the command is unavailable. */
  runCommand: (id: string) => Promise<void>;
  /** Opens a vault file in a new tab with its default view (the Markdown editor for .md). */
  openFile: (relative: string) => Promise<void>;
  /** The view type and file of the active tab. */
  activeView: () => Promise<{ type: string; file: string | null; title: string }>;
  /** Switches Obsidian's base color scheme. */
  setTheme: (scheme: 'light' | 'dark') => Promise<void>;
  /** Sets Obsidian's interface language and reloads the app, as the language setting does. */
  setLanguage: (language: string) => Promise<void>;
  /** Saves the workspace layout, quits Obsidian and starts it again with the same profile and vault. */
  relaunch: () => Promise<void>;
}

/** Vault files to write over the copy of samples/, by vault-relative path. */
export type VaultFiles = Record<string, string>;

// The parts of Obsidian's global `app` that the tests use; commands, plugins, changeTheme and
// the workspace's leaf internals are not all in the public API typings.
interface ViewLeaf {
  view: { getViewType: () => string; getDisplayText: () => string; file?: { path: string } | null };
}
interface AppWindow {
  app: {
    workspace: {
      layoutReady: boolean;
      getLeaf: (kind: 'tab') => { openFile: (file: unknown) => Promise<void> };
      getMostRecentLeaf: () => ViewLeaf | null;
      requestSaveLayout: { run: () => Promise<void> | void };
    };
    vault: { getFileByPath: (path: string) => unknown };
    plugins: { plugins: Record<string, unknown> };
    commands: { executeCommandById: (id: string) => boolean };
    changeTheme: (theme: 'obsidian' | 'moonstone') => void;
  };
}

async function waitForFile(file: string) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (existsSync(file)) return readFile(file, 'utf8');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${file}`);
}

// Waits until the workspace is ready and this plugin has loaded, after a launch or a reload.
async function waitForPlugin(page: Page) {
  await page.waitForFunction(id => {
    const { app } = window as unknown as Partial<AppWindow>;
    return !!app?.workspace?.layoutReady && !!app.plugins?.plugins[id];
  }, pluginId, { timeout: 30_000 });
}

// Starts Obsidian on `profile` and attaches Playwright to its window. Playwright's
// _electron.launch needs the Node inspector, which the packaged app disables, so the app is
// started with a DevTools port and Playwright connects over CDP.
async function launch(profile: string) {
  const portFile = path.join(profile, 'DevToolsActivePort');
  await rm(portFile, { force: true });
  const child = spawn(executable, [`--user-data-dir=${profile}`, '--remote-debugging-port=0', '--lang=en-US'], { stdio: 'ignore' });
  const exited = new Promise(resolve => child.once('exit', resolve));
  const quit = async () => {
    child.kill();
    // A hung app ignores SIGTERM; never leave an Obsidian process behind.
    const timer = setTimeout(() => child.kill('SIGKILL'), 10_000);
    await exited;
    clearTimeout(timer);
  };
  try {
    const port = (await waitForFile(portFile)).split('\n')[0];
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? await context.waitForEvent('page');
    const errors: string[] = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    return {
      page,
      errors,
      close: async () => {
        // Disconnect first so Playwright does not react to the window closing.
        await browser.close();
        await quit();
      },
    };
  } catch (error) {
    await quit();
    throw error;
  }
}

export const test = base.extend<{ vaultFiles: VaultFiles; obsidian: Obsidian }>({
  vaultFiles: [{}, { option: true }],

  obsidian: async ({ vaultFiles }, use) => {
    if (skipReason) throw new Error(skipReason);
    const dir = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-obsidian-'));
    // A separate Chromium profile keeps the user's Obsidian settings, vault list and running app untouched.
    const profile = path.join(dir, 'profile');
    const vault = path.join(dir, 'vault');
    const pluginDir = path.join(vault, '.obsidian', 'plugins', pluginId);
    await mkdir(profile, { recursive: true });
    await mkdir(pluginDir, { recursive: true });
    await cp(path.join(root, 'samples'), vault, { recursive: true });
    for (const [relative, text] of Object.entries(vaultFiles)) {
      await mkdir(path.dirname(path.join(vault, relative)), { recursive: true });
      await writeFile(path.join(vault, relative), text);
    }
    for (const asset of ['main.js', 'manifest.json', 'styles.css']) {
      await cp(path.join(root, 'dist', asset), path.join(pluginDir, asset));
    }
    await writeFile(path.join(vault, '.obsidian', 'community-plugins.json'), JSON.stringify([pluginId]));
    // On macOS Obsidian shows native menus by default, which Playwright cannot see and which
    // block the app while open; HTML menus can be clicked like the rest of the window.
    await writeFile(path.join(vault, '.obsidian', 'app.json'), JSON.stringify({ nativeMenus: false }));
    // Opens the test vault on launch instead of the vault picker, and skips the update download.
    await writeFile(path.join(profile, 'obsidian.json'), JSON.stringify({
      updateDisabled: true,
      vaults: { '0123456789abcdef': { path: vault, ts: Date.now(), open: true } },
    }));

    let session = await launch(profile);
    try {
      // A vault with community plugins first opens in Restricted mode and asks whether to trust its author.
      // Trusting it then opens the community plugin settings, which cover the workspace.
      await session.page.getByRole('button', { name: 'Trust author and enable plugins' }).click({ timeout: 30_000 });
      await waitForPlugin(session.page);
      await session.page.locator('.modal.mod-settings').waitFor();
      await session.page.keyboard.press('Escape');
      await expect(session.page.locator('.modal-container')).toHaveCount(0);

      await use({
        get page() { return session.page; },
        get errors() { return session.errors; },
        readFile: relative => readFile(path.join(vault, relative), 'utf8'),
        runCommand: async id => {
          const found = await session.page.evaluate(id => (window as unknown as AppWindow).app.commands.executeCommandById(id), id);
          if (!found) throw new Error(`Command ${id} is missing or unavailable`);
        },
        openFile: async relative => {
          await session.page.evaluate(async relative => {
            const { app } = window as unknown as AppWindow;
            const file = app.vault.getFileByPath(relative);
            if (!file) throw new Error(`No file ${relative}`);
            await app.workspace.getLeaf('tab').openFile(file);
          }, relative);
        },
        activeView: () => session.page.evaluate(() => {
          const { view } = (window as unknown as AppWindow).app.workspace.getMostRecentLeaf()!;
          return { type: view.getViewType(), file: view.file?.path ?? null, title: view.getDisplayText() };
        }),
        setTheme: async scheme => {
          await session.page.evaluate(theme => (window as unknown as AppWindow).app.changeTheme(theme), scheme === 'dark' ? 'obsidian' as const : 'moonstone' as const);
          await expect(session.page.locator('body')).toHaveClass(new RegExp(`\\btheme-${scheme}\\b`));
        },
        setLanguage: async language => {
          const { page } = session;
          await page.evaluate(language => localStorage.setItem('language', language), language);
          await Promise.all([
            page.waitForEvent('load'),
            page.evaluate(() => (window as unknown as AppWindow).app.commands.executeCommandById('app:reload')),
          ]);
          await waitForPlugin(page);
        },
        relaunch: async () => {
          // Obsidian writes the layout shortly after it changes; flush it instead of waiting.
          await session.page.evaluate(() => (window as unknown as AppWindow).app.workspace.requestSaveLayout.run());
          await session.close();
          session = await launch(profile);
          await waitForPlugin(session.page);
        },
      });
    } finally {
      await session.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
});
