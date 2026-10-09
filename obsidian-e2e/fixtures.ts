import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium, test as base, expect, type Page } from '@playwright/test';

export { expect };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginId = 'markdown-outliner';

/**
 * The Obsidian executable to test: OBSIDIAN_EXECUTABLE, or on macOS the default install location.
 * CI sets it to the Linux build (.github/workflows/obsidian.yml). The tests are skipped only when
 * the variable is unset and Obsidian is not at the default location; a wrong path set in the
 * variable fails them.
 */
const configured = process.env.OBSIDIAN_EXECUTABLE;
const executable = configured || (process.platform === 'darwin' ? '/Applications/Obsidian.app/Contents/MacOS/Obsidian' : undefined);
export const skipReason = configured ? null
  : !executable ? 'Set OBSIDIAN_EXECUTABLE to the Obsidian executable.'
  : existsSync(executable) ? null : `Obsidian not found at ${executable}; set OBSIDIAN_EXECUTABLE to the Obsidian executable.`;
/** OBSIDIAN_E2E_HEADED=1 starts Obsidian as a normal foreground app on macOS, to watch or debug a test. */
const headed = process.env.OBSIDIAN_E2E_HEADED === '1';

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

// Obsidian's renderer has Node integration and @electron/remote.
interface BrowserWindow {
  id: number;
  setOpacity: (opacity: number) => void;
  setIgnoreMouseEvents: (ignore: boolean) => void;
  setFocusable: (focusable: boolean) => void;
  close: () => void;
}
interface ElectronWindow {
  require: (module: '@electron/remote') => {
    getCurrentWindow: () => BrowserWindow;
    BrowserWindow: { getAllWindows: () => BrowserWindow[] };
    app: { on: (event: 'browser-window-created', listener: (event: unknown, window: BrowserWindow) => void) => void };
  };
}

// The community plugin settings that Obsidian opens after the vault's author is trusted: a modal
// over the workspace in Obsidian 1.12, a separate window in 1.14.
function openSettings() {
  if (document.querySelector('.modal.mod-settings')) return 'modal';
  const remote = (window as unknown as ElectronWindow).require('@electron/remote');
  if (remote.BrowserWindow.getAllWindows().length > 1) return 'window';
  // Obsidian opens menus in the window it last saw focused; that must be the main window again.
  return (window as unknown as { activeWindow: Window }).activeWindow === window ? 'none' : 'focus elsewhere';
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

// macOS has no headless mode for a GUI app. Unless OBSIDIAN_E2E_HEADED=1, Obsidian is started
// through LaunchServices in the background (`open -g`), so it does not take the focus, and its
// window is made transparent and click-through as soon as Playwright attaches, which is before
// Obsidian first shows it. On Linux, CI runs the app under Xvfb instead.
const hideWindow = process.platform === 'darwin' && !headed;

// Chromium stops rendering windows it considers hidden or occluded, which would stall Playwright's
// actionability checks and screenshots while the window is transparent or behind other windows.
const renderFlags = ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'];

function isRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Stops the Obsidian main process; a hung app ignores SIGTERM, so it is killed after 10 seconds.
// Never leaves an Obsidian process behind.
async function stop(pid: number) {
  if (isRunning(pid)) process.kill(pid, 'SIGTERM');
  for (let waited = 0; isRunning(pid); waited += 100) {
    if (waited === 10_000) process.kill(pid, 'SIGKILL');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Starts the Obsidian process on `args` and returns its process id.
async function start(args: string[], profile: string) {
  if (!hideWindow) {
    const child = spawn(executable!, args, { stdio: 'ignore' });
    if (child.pid === undefined) throw new Error(`Could not start ${executable}`);
    return child.pid;
  }
  // `open` exits once LaunchServices has started the app, so the process is found by its command
  // line. -n starts a new instance next to a running Obsidian; -g keeps it in the background.
  const bundle = path.resolve(executable!, '../../..');
  await promisify(execFile)('open', ['-g', '-n', '-a', bundle, '--args', ...args]);
  const prefix = `${executable} --user-data-dir=${profile} `;
  for (let attempt = 0; attempt < 50; attempt++) {
    const { stdout } = await promisify(execFile)('ps', ['-axww', '-o', 'pid=,command=']);
    const line = stdout.split('\n').find(line => line.trim().replace(/^\d+ /, '').startsWith(prefix));
    if (line) return Number(line.trim().split(' ')[0]);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Obsidian did not start from ${bundle}`);
}

// Starts Obsidian on `profile` and attaches Playwright to its window. Playwright's
// _electron.launch needs the Node inspector, which the packaged app disables, so the app is
// started with a DevTools port and Playwright connects over CDP.
async function launch(profile: string) {
  const portFile = path.join(profile, 'DevToolsActivePort');
  await rm(portFile, { force: true });
  const pid = await start([`--user-data-dir=${profile}`, '--remote-debugging-port=0', '--lang=en-US', ...renderFlags], profile);
  try {
    const port = (await waitForFile(portFile)).split('\n')[0];
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? await context.waitForEvent('page');
    if (hideWindow) {
      // Obsidian shows its window only after the page has loaded, so this usually runs before the
      // window first appears. `require('electron').remote` is set later than the window shows, so
      // the module is required directly. Without setFocusable(false), text the user typed with an
      // input method in another app could land in the window. Windows Obsidian opens later, such
      // as the settings window of 1.14, are hidden the same way when they are created.
      await page.evaluate(() => {
        const remote = (globalThis as unknown as ElectronWindow).require('@electron/remote');
        const hide = (window: BrowserWindow) => {
          window.setOpacity(0);
          window.setIgnoreMouseEvents(true);
          window.setFocusable(false);
        };
        hide(remote.getCurrentWindow());
        remote.app.on('browser-window-created', (_event, window) => hide(window));
      });
    }
    const errors: string[] = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    return {
      page,
      errors,
      close: async () => {
        // Disconnect first so Playwright does not react to the window closing.
        await browser.close();
        await stop(pid);
      },
    };
  } catch (error) {
    await stop(pid);
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
      // Trusting it then opens the community plugin settings, which are closed.
      const { page } = session;
      await page.getByRole('button', { name: 'Trust author and enable plugins' }).click({ timeout: 30_000 });
      await waitForPlugin(page);
      await expect.poll(() => page.evaluate(openSettings)).toMatch(/^(modal|window)$/);
      if (await page.evaluate(openSettings) === 'modal') {
        await page.keyboard.press('Escape');
      } else {
        await page.evaluate(() => {
          const remote = (window as unknown as ElectronWindow).require('@electron/remote');
          const main = remote.getCurrentWindow();
          for (const other of remote.BrowserWindow.getAllWindows()) if (other.id !== main.id) other.close();
        });
      }
      await expect.poll(() => page.evaluate(openSettings)).toBe('none');
      await expect(page.locator('.modal-container')).toHaveCount(0);

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
