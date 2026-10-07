# Markdown Outliner

An outliner for Markdown task lists. It runs as an Obsidian plugin and as a small local web app, and both share the same editing core. Files stay plain Markdown, so they can be edited side by side with Git, other editors, and coding agents.

The user interface is available in English and Japanese. The Obsidian plugin follows Obsidian's display language (Obsidian 1.8.7 or later; older versions use English), and the web version follows the browser language. Any other language falls back to English.

## Features

- Edit `- [ ]` / `- [/]` / `- [x]` tasks and plain bullets as an outline, with notes indented under each item.
- Filter by status, tags, and title text, and keep adding tasks, children, and notes while a filter is active. New tasks get the current status and tags.
- Change hierarchy with Tab / Shift+Tab, move items with Alt+Up/Down or drag and drop, and select several siblings to move or update them together.
- Zoom into an item, collapse items and embeds, and bookmark files and searches.
- Item-level embeds such as `- ![[work.md]]` are edited in place and saved back to the embedded file. Embeds are resolved relative to the embedding file's folder.
- Undo / Redo, auto-save about 0.8 seconds after the last edit, and conflict handling: if a file changed on disk while you were editing it, changes to different lines are merged automatically (this clears the undo history). If both sides changed the same line, your input is kept and the differing lines are shown so you can choose which version to use there.
- External changes are picked up every few seconds. While a field has focus, the status says that a change is waiting, and the change is shown when you leave the field or come back to the tab or window, with the cursor kept on the same item.

Headings, code blocks, and other non-list content are preserved but not shown.

## Install in Obsidian

### With BRAT

1. Install and enable the community plugin "BRAT" (Obsidian42 - BRAT).
2. In BRAT's settings, choose "Add beta plugin" and enter `hota911/markdown-outliner`.
3. Enable "Markdown Outliner" in Settings > Community plugins.

### Manually

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [GitHub Release](https://github.com/hota911/markdown-outliner/releases).
2. Put them in `<vault>/.obsidian/plugins/markdown-outliner/`.
3. Reload Obsidian and enable "Markdown Outliner" in Settings > Community plugins.

Open the outliner from the ribbon icon or the command "Open outliner" ("アウトライナーを開く" in Japanese). The plugin edits any `.md` file in the vault, and opens the file shown last, or the first Markdown file of the vault. Unsaved input is kept in memory while the plugin is enabled; save before quitting Obsidian or disabling the plugin. The plugin has been used on desktop; on phones see [Touch screens](#touch-screens).

Experimental: a single file can also open as an outline in its own tab. Choose "Open as outline" ("アウトラインで開く") from a `.md` file's menu, or run the command of the same name to switch the active Markdown editor to the outline. From a tab's own menu it switches that tab; from the file explorer or a link's menu it opens a new tab. The tab is titled with the file name, works with back and forward navigation, and is restored when Obsidian restarts. "Open as Markdown" in the tab's menu switches it back to the regular editor. The file picker in the toolbar still lists the whole vault, so it can show another file inside the same tab.

## Touch screens

On a device whose main pointer is a finger (CSS `pointer: coarse`, such as a phone or Obsidian mobile), a bar appears at the bottom of the outliner while an item's text or note is being edited. Soft keyboards have no Tab, Alt or Shift+Enter, so the bar has these commands: outdent (Shift+Tab), indent (Tab), move up and down (Alt+Up/Down), change the task status, switch between the text and the note (Shift+Enter), undo and redo. The buttons do not take the focus, so the keyboard stays open. The status button cycles not started, in progress, done like the status icon of the item, unlike Cmd+Enter, which only marks the item done.

Other differences on touch screens:

- The buttons of an item (add a child, zoom, move to a file) appear under the item that is being edited, not on the item under the finger. The note and move buttons are in the bar instead.
- Tapping the ⠿ handle selects the item. Dragging by touch is not supported; use the bar's move buttons, or select items and use the selection bar.
- Buttons are at least 36px high, the keyboard shortcut help is hidden, and on screens 600px wide or narrower the bookmarks are shown above the outline.

The touch layout is tested in Chromium emulating a Pixel 7 (`e2e/mobile.spec.ts`). It has not been checked on a real Android or iOS device or in the Obsidian mobile app.

## Web version

Requires Node.js 24 or later.

```sh
npm ci
npm run build:web
node server.mjs [folder-or-file] [port]
```

Then open `http://127.0.0.1:<port>/` (default port 4317). Without arguments the server edits the bundled `samples/` folder in place, so copy it first if you want to keep the originals. Passing a single `.md` file restricts the server to that file. For a folder, the page opens the file shown last, or the first Markdown file of the folder. The server only listens on 127.0.0.1, serves the built app from `dist/web/`, and bookmarks and the file shown last are stored in the browser's local storage. `npm start` builds the web app and runs the server with the defaults.

## Mac app (prototype)

A minimal native macOS app (macOS 11 or later) that runs the same UI in a `WKWebView`. It is a prototype to judge the approach: it is not distributed, notarized, or tested beyond the checks below. Building it needs Node.js and the Xcode Command Line Tools (`swiftc`, `codesign`); the Xcode app is not required.

```sh
npm ci
npm run build:mac   # writes dist/mac/Markdown Outliner.app (ad-hoc signed)
open "dist/mac/Markdown Outliner.app"
```

On first launch the app asks for a folder, which plays the role of the folder passed to `server.mjs`: the app lists, reads, saves, and creates `.md` files inside it, and opens `tasks.md` first. File > Open Folder… (Cmd+O) switches to another folder. The last folder is remembered as a plain path in the app's user defaults; the app is not sandboxed, so it needs no security-scoped bookmark. `open "dist/mac/Markdown Outliner.app" --args -folder <path>` opens a folder for one launch without remembering it. Bookmarks are stored per folder in the same user defaults (`io.github.hota911.markdown-outliner`).

How it works:

- `mac/main.swift` creates the window, the menus (including the standard Edit menu, so Cmd+C/V/X/A/Z reach the web view), and a `WKWebView` that loads the page from the app's `Resources/web` through the `outliner://app/` URL scheme, without `file://` or a local HTTP server.
- The page (`src/mac/`, built by `vite.mac.config.ts`) implements the `Adapter` by posting messages to `window.webkit.messageHandlers.outliner` (`src/mac/adapter.ts`). `mac/main.swift` answers them with `WKScriptMessageHandlerWithReply`.
- `mac/Workspace.swift` ports the file API of `server.mjs`: the same path checks (no `..`, absolute paths, backslashes, or symbolic links leading outside the folder), SHA-256 revisions, the revision check on save that lets the outliner merge external changes, and the same error codes, which the page shows with the web version's messages. `npm run test:mac` compiles and runs `mac/Tests/WorkspaceTests.swift` against it.
- Colors come from `src/web/theme.css`, so the page follows the system's light or dark appearance.

Limits: the window has no unsaved-changes guard, so input typed less than a second before quitting or switching folders can be lost; one window and one folder at a time; only the native architecture is built. `npm run build:mac -- --debug` builds a debug variant whose `-debugScript <file>` launch argument evaluates a script in the page (see `mac/main.swift`); it was used to check rendering, saving, external changes, merges, and both appearances without UI automation permissions.

## Development

The UI is written in Svelte 5 and TypeScript and built with Vite. Open development tasks are listed in [TODO.md](TODO.md).

```sh
npm ci              # install the development tools
npm run dev         # Vite dev server with hot reload and the file API on http://127.0.0.1:5173/
npm run dev:plugin  # watch mode: rebuild the Obsidian plugin into $OBSIDIAN_VAULT/.obsidian/plugins/markdown-outliner/
npm run lint        # ESLint with eslint-plugin-obsidianmd and eslint-plugin-svelte
npm run typecheck   # svelte-check over src/, e2e/, obsidian-e2e/ and the Vite and Playwright configs
npm test            # run test:node and test:ui
npm run test:node   # core, row key, server and packaging tests with node --test
npm run test:ui     # screen tests (test/ui/) and Obsidian adapter tests with Vitest and jsdom
npm run test:e2e    # build the web app, then run the browser tests (e2e/) in Chromium with Playwright, on desktop and as a Pixel 7
npm run test:obsidian # macOS only: build the plugin, then test it inside the Obsidian desktop app (obsidian-e2e/)
npm run build       # write dist/web/ and the plugin files dist/main.js, manifest.json, styles.css
npm run build:mac   # macOS only: build the Mac app prototype into dist/mac/
npm run test:mac    # macOS only: compile and run the Swift file API tests
```

`npm run dev` edits `samples/` by default; set `OUTLINER_WORKSPACE` to a folder or a single Markdown file to edit something else.

`npm run dev:plugin` loads the in-progress build into Obsidian. Set `OBSIDIAN_VAULT` to the path of a vault (a folder with `.obsidian/`); the script exits with a message if it is unset or the folder is not a vault. It rebuilds `main.js` on every source change and copies `manifest.json` and `styles.css` next to it. Obsidian does not notice the new files by itself: install the [Hot Reload](https://github.com/pjeby/hot-reload) community plugin and add an empty `.hotreload` file to the plugin folder so it reloads on change, or toggle Markdown Outliner off and on in Obsidian's community plugin settings after each build.

The screen tests drive the rendered DOM with keyboard and pointer events against an in-memory file adapter, and check the saved Markdown. jsdom has no layout or drag and drop, so dragging is tested with Playwright instead: each test in `e2e/` writes a Markdown file to a temporary folder, starts `server.mjs` on it, drags with the mouse in Chromium, and checks the file on disk. `npm test` does not include these tests because they need a browser. Before the first run, download Chromium with `npx playwright install chromium`.

`npm run test:obsidian` tests the built plugin inside the Obsidian desktop app on macOS. It uses `/Applications/Obsidian.app`, or the app bundle set in `OBSIDIAN_APP`, and skips its tests when neither exists. Each test starts a separate Obsidian process with a new temporary profile (`--user-data-dir`) and a temporary vault copied from `samples/`, then deletes both, so it never reads or changes your Obsidian settings, vaults, or a running Obsidian. Playwright attaches to the window over the DevTools protocol. The tests check that the plugin loads without console errors; that the ribbon icon and the commands open the outliner and the per-file outline view; that edits, status changes and drag and drop are saved to the file; that "Open as Markdown" switches back and the outline tab is restored after a restart; that the text follows the light and dark themes; and that the labels are Japanese when Obsidian's language is Japanese. The test vault turns off native menus so Playwright can click Obsidian's menus. These tests open Obsidian windows on your screen and are not run in CI, `npm test`, or `npm run test:e2e`.

CI runs lint, typecheck, `npm test`, `npm run test:e2e` and `npm run build` on pull requests and on pushes to `main`, and `npm run test:mac` and `npm run build:mac` in a separate macOS job.

Source layout:

- `src/core.ts`: Markdown parsing and editing operations, shared by both versions.
- `src/ui/`: the outliner UI, shared by both versions. `controller.svelte.ts` holds the editing state and operations, the `.svelte` files render it, and `mount.ts` mounts it into an element.
- `src/obsidian/`: the Obsidian plugin entry point (`main.ts`).
- `src/web/`: the standalone web page.
- `src/mac/` and `mac/`: the page and the Swift sources of the Mac app prototype; `vite.mac.config.ts` and `scripts/build-mac.mjs` build it.
- `src/styles.css`: styles for both versions. Colors and fonts use Obsidian's theme variables, so the plugin follows the Obsidian theme; `src/web/theme.css` defines them for the web page in light and dark sets that follow the system setting.
- `server.mjs`: the local web server and file API, also mounted by the dev server.
- `vite.config.ts`: the plugin build (a single CommonJS `main.js`).
- `vite.web.config.ts`: the web app build and dev server.
- `scripts/package-plugin.mjs`: builds the plugin and copies `manifest.json` and `styles.css` into `dist/`.
- `scripts/changelog-section.mjs`: prints one version's section of `CHANGELOG.md`, used as the release notes.
- `e2e/`: Playwright tests in Chromium (drag and drop, layout, and the touch screen layout in `mobile.spec.ts`); `playwright.config.ts` runs `mobile.spec.ts` as a Pixel 7 and the rest as desktop Chrome.
- `obsidian-e2e/`: Playwright tests of the plugin in the Obsidian desktop app, with their own `playwright.config.ts`; `fixtures.ts` starts Obsidian and has helpers to open a file, run a command by id, and read a vault file.

The plugin build bundles Svelte and the shared code into `main.js`, so the released `main.js` only requires `obsidian`.

## Release

1. On a branch, run `npm version <patch|minor|major> --no-git-tag-version`. This updates `package.json`, `package-lock.json`, `manifest.json`, and `versions.json` (the `version` script copies the version and `minAppVersion`).
2. In the same branch, move the entries under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md) to a new `## [X.Y.Z] - YYYY-MM-DD` heading, leave `## [Unreleased]` empty, and update the compare links at the bottom. `npm test` fails if CHANGELOG.md has no entries for the version in `package.json`.
3. Commit the changes, open a PR, and merge it to `main`.
4. On the updated `main`, push a tag equal to the version, without a `v` prefix: `git tag 0.1.0 && git push origin 0.1.0`.

The `Release` workflow checks that the tag matches the versions, runs lint, typecheck, tests, and the build, attests build provenance, then publishes a GitHub Release with `main.js`, `manifest.json`, and `styles.css` attached. The release notes are the tag's section of CHANGELOG.md (`node scripts/changelog-section.mjs <version>` prints it); the workflow fails if that section is missing or empty.

Pull requests with user-facing changes add an entry under `## [Unreleased]` in CHANGELOG.md, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) (Added, Changed, Fixed, Security, and so on). Changes that only affect development, such as tests, CI, or dependency updates that do not reach the released files, need no entry.

## 概要（日本語）

Markdown のタスクリストをアウトラインとして編集するツールである。Obsidian プラグインとローカルで動く Web 版があり、編集処理と画面は共通である。絞り込み中もタスク・子タスク・ノートを追加して階層を編集でき、`- ![[work.md]]` のような埋め込み先へも書き戻す。ファイルは普通の Markdown のままなので、Git や他のエディタ、コーディングエージェントと同じファイルを扱える。

## License

[MIT](LICENSE)
