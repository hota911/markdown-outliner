import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, test as base, expect, type Browser, type Page } from '@playwright/test';

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
  /** The Obsidian window. */
  page: Page;
  /** Absolute path of the test vault. */
  vault: string;
  /** Console errors and uncaught exceptions of the window since launch. */
  errors: string[];
  /** Reads a file of the vault from disk. */
  readFile: (relative: string) => Promise<string>;
  /** Runs a command by id, such as `markdown-outliner:open-outliner`. Fails if the command does not exist. */
  runCommand: (id: string) => Promise<void>;
  /** Opens a vault file in a new tab. */
  openFile: (relative: string) => Promise<void>;
  /** Switches Obsidian's base color scheme. */
  setTheme: (scheme: 'light' | 'dark') => Promise<void>;
  /** Sets Obsidian's interface language and reloads the app, as the language setting does. */
  setLanguage: (language: string) => Promise<void>;
}

/** Vault files to write over the copy of samples/, by vault-relative path. */
export type VaultFiles = Record<string, string>;

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
    const { app } = window as Partial<AppWindow>;
    return !!app?.workspace.layoutReady && !!app.plugins.plugins[id];
  }, pluginId, { timeout: 30_000 });
}

// The parts of Obsidian's global `app` that the tests use; commands, plugins and changeTheme
// are not in the public API typings.
type AppWindow = Window & {
  app: {
    workspace: { layoutReady: boolean; getLeaf: (kind: 'tab') => { openFile: (file: unknown) => Promise<void> } };
    vault: { getFileByPath: (path: string) => unknown };
    plugins: { plugins: Record<string, unknown> };
    commands: { executeCommandById: (id: string) => boolean };
    changeTheme: (theme: 'obsidian' | 'moonstone') => void;
  };
};

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
    // Opens the test vault on launch instead of the vault picker, and skips the update download.
    await writeFile(path.join(profile, 'obsidian.json'), JSON.stringify({
      updateDisabled: true,
      vaults: { '0123456789abcdef': { path: vault, ts: Date.now(), open: true } },
    }));

    // Playwright's _electron.launch needs the Node inspector, which the packaged app disables,
    // so the app is started with a DevTools port and Playwright attaches over CDP.
    const app: ChildProcess = spawn(executable, [`--user-data-dir=${profile}`, '--remote-debugging-port=0', '--lang=en-US'], { stdio: 'ignore' });
    const exited = new Promise(resolve => app.once('exit', resolve));
    let browser: Browser | undefined;
    try {
      const port = (await waitForFile(path.join(profile, 'DevToolsActivePort'))).split('\n')[0];
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      const context = browser.contexts()[0];
      const page = context.pages()[0] ?? await context.waitForEvent('page');
      const errors: string[] = [];
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('pageerror', error => errors.push(error.message));

      // A vault with community plugins first opens in Restricted mode and asks whether to trust its author.
      await page.getByRole('button', { name: 'Trust author and enable plugins' }).click({ timeout: 30_000 });
      await waitForPlugin(page);

      await use({
        page,
        vault,
        errors,
        readFile: relative => readFile(path.join(vault, relative), 'utf8'),
        runCommand: async id => {
          const found = await page.evaluate(id => (window as AppWindow).app.commands.executeCommandById(id), id);
          if (!found) throw new Error(`No command ${id}`);
        },
        openFile: async relative => {
          await page.evaluate(async relative => {
            const { app } = window as AppWindow;
            const file = app.vault.getFileByPath(relative);
            if (!file) throw new Error(`No file ${relative}`);
            await app.workspace.getLeaf('tab').openFile(file);
          }, relative);
        },
        setTheme: async scheme => {
          await page.evaluate(theme => (window as AppWindow).app.changeTheme(theme), scheme === 'dark' ? 'obsidian' : 'moonstone');
          await expect(page.locator('body')).toHaveClass(new RegExp(`\\btheme-${scheme}\\b`));
        },
        setLanguage: async language => {
          await page.evaluate(language => localStorage.setItem('language', language), language);
          await Promise.all([
            page.waitForEvent('load'),
            page.evaluate(() => (window as AppWindow).app.commands.executeCommandById('app:reload')),
          ]);
          await waitForPlugin(page);
        },
      });
    } finally {
      // Disconnect first so Playwright does not react to the window closing.
      await browser?.close();
      app.kill();
      await exited;
      await rm(dir, { recursive: true, force: true });
    }
  },
});
