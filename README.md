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

Open the outliner from the ribbon icon or the command "Open outliner" ("アウトライナーを開く" in Japanese). The plugin edits any `.md` file in the vault. Unsaved input is kept in memory while the plugin is enabled; save before quitting Obsidian or disabling the plugin. The plugin has been used on desktop; mobile has not been tested.

Experimental: a single file can also open as an outline in its own tab. Choose "Open as outline" ("アウトラインで開く") from a `.md` file's menu, or run the command of the same name to switch the active Markdown editor to the outline. From a tab's own menu it switches that tab; from the file explorer or a link's menu it opens a new tab. The tab is titled with the file name, works with back and forward navigation, and is restored when Obsidian restarts. "Open as Markdown" in the tab's menu switches it back to the regular editor. The file picker in the toolbar still lists the whole vault, so it can show another file inside the same tab.

## Web version

Requires Node.js 24 or later.

```sh
npm ci
npm run build:web
node server.mjs [folder-or-file] [port]
```

Then open `http://127.0.0.1:<port>/` (default port 4317). Without arguments the server edits the bundled `samples/` folder in place, so copy it first if you want to keep the originals. Passing a single `.md` file restricts the server to that file. The server only listens on 127.0.0.1, serves the built app from `dist/web/`, and bookmarks are stored in the browser's local storage. `npm start` builds the web app and runs the server with the defaults.

## Desktop app (Tauri prototype)

A macOS app built with [Tauri 2](https://v2.tauri.app/): the same UI in the system web view, with the file access of `server.mjs` ported to Rust (`src-tauri/`). It is a prototype and an alternative to the Swift app in PR #26. It requires Rust and the Tauri CLI (`cargo install tauri-cli --version "^2"`), plus the Xcode Command Line Tools on macOS.

```sh
npm ci
npm run build:tauri   # writes src-tauri/target/release/bundle/macos/Markdown Outliner.app
npm run tauri:dev     # runs the app with the Vite dev server and hot reload
npm run test:tauri    # the Rust tests (cargo test)
```

On first launch the app asks for a folder; File > Open Folder… (Cmd+O) switches to another one. The window title is the folder name. The app edits the `.md` files in that folder with the same checks and error codes as `server.mjs`: paths that leave the folder, including through symbolic links, are rejected, files over 2 MB are refused, and a save is rejected when the file changed since it was read, so the outliner merges the change as in the web version. It remembers the last folder as a plain path in `~/Library/Application Support/io.github.hota911.markdown-outliner/last-folder`, and the bookmarks of each folder in `preferences/` next to it. Setting `OUTLINER_WORKSPACE` to a folder opens that folder for one launch without remembering it.

The page can call only the app's six file and preference commands (`src-tauri/capabilities/main.json`); it has no general file system or shell access. Debug builds (`npm run tauri:dev`, `cargo tauri build --debug`) also read `OUTLINER_DEBUG_SCRIPT` and `OUTLINER_DEBUG_THEME`, described in `src-tauri/src/debug.rs`, to check the app without UI automation; release builds leave that code out.

Limits:

- The app is signed ad hoc, not notarized, and there is no DMG. macOS blocks it when it is copied to another Mac until it is allowed in System Settings > Privacy & Security.
- It opens folders only; the single-file mode of `server.mjs` is not ported.
- It has been built and run on macOS only. Tauri 2 can also build for Windows, Linux, iOS and Android, but those targets need their own setup (for Android, the Android NDK) and have not been tried.

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
npm run test:e2e    # build the web app, then run the drag and drop tests (e2e/) in Chromium with Playwright
npm run test:obsidian # macOS only: build the plugin, then test it inside the Obsidian desktop app (obsidian-e2e/)
npm run build       # write dist/web/ and the plugin files dist/main.js, manifest.json, styles.css
```

`npm run dev` edits `samples/` by default; set `OUTLINER_WORKSPACE` to a folder or a single Markdown file to edit something else.

`npm run dev:plugin` loads the in-progress build into Obsidian. Set `OBSIDIAN_VAULT` to the path of a vault (a folder with `.obsidian/`); the script exits with a message if it is unset or the folder is not a vault. It rebuilds `main.js` on every source change and copies `manifest.json` and `styles.css` next to it. Obsidian does not notice the new files by itself: install the [Hot Reload](https://github.com/pjeby/hot-reload) community plugin and add an empty `.hotreload` file to the plugin folder so it reloads on change, or toggle Markdown Outliner off and on in Obsidian's community plugin settings after each build.

The screen tests drive the rendered DOM with keyboard and pointer events against an in-memory file adapter, and check the saved Markdown. jsdom has no layout or drag and drop, so dragging is tested with Playwright instead: each test in `e2e/` writes a Markdown file to a temporary folder, starts `server.mjs` on it, drags with the mouse in Chromium, and checks the file on disk. `npm test` does not include these tests because they need a browser. Before the first run, download Chromium with `npx playwright install chromium`.

`npm run test:obsidian` tests the built plugin inside the Obsidian desktop app on macOS. It uses `/Applications/Obsidian.app`, or the app bundle set in `OBSIDIAN_APP`, and skips its tests when neither exists. Each test starts a separate Obsidian process with a new temporary profile (`--user-data-dir`) and a temporary vault copied from `samples/`, then deletes both, so it never reads or changes your Obsidian settings, vaults, or a running Obsidian. Playwright attaches to the window over the DevTools protocol. The tests check that the plugin loads without console errors; that the ribbon icon and the commands open the outliner and the per-file outline view; that edits, status changes and drag and drop are saved to the file; that "Open as Markdown" switches back and the outline tab is restored after a restart; that the text follows the light and dark themes; and that the labels are Japanese when Obsidian's language is Japanese. The test vault turns off native menus so Playwright can click Obsidian's menus. These tests open Obsidian windows on your screen and are not run in CI, `npm test`, or `npm run test:e2e`.

CI runs lint, typecheck, `npm test`, `npm run test:e2e` and `npm run build` on pull requests and on pushes to `main`. A separate workflow (`.github/workflows/tauri.yml`) runs the Rust tests of the desktop app on macOS only when `src-tauri/` or `package.json` changes; it is not a required check, because a macOS runner and a cold Tauri build take several minutes.

Source layout:

- `src/core.ts`: Markdown parsing and editing operations, shared by both versions.
- `src/ui/`: the outliner UI, shared by both versions. `controller.svelte.ts` holds the editing state and operations, the `.svelte` files render it, and `mount.ts` mounts it into an element.
- `src/obsidian/`: the Obsidian plugin entry point (`main.ts`).
- `src/web/`: the standalone web page.
- `src/tauri/`: the page of the desktop app; `adapter.ts` calls the Rust commands.
- `src-tauri/`: the desktop app. `src/workspace.rs` is the file access ported from `server.mjs`, with its tests; `src/lib.rs` has the commands, the folder dialog, the menu and the window.
- `src/styles.css`: styles for both versions. Colors and fonts use Obsidian's theme variables, so the plugin follows the Obsidian theme; `src/web/theme.css` defines them for the web page in light and dark sets that follow the system setting.
- `server.mjs`: the local web server and file API, also mounted by the dev server.
- `vite.config.ts`: the plugin build (a single CommonJS `main.js`).
- `vite.web.config.ts`: the web app build and dev server.
- `vite.tauri.config.ts`: the desktop app's page build and dev server.
- `scripts/package-plugin.mjs`: builds the plugin and copies `manifest.json` and `styles.css` into `dist/`.
- `e2e/`: Playwright tests in Chromium (drag and drop); `playwright.config.ts` configures them.
- `obsidian-e2e/`: Playwright tests of the plugin in the Obsidian desktop app, with their own `playwright.config.ts`; `fixtures.ts` starts Obsidian and has helpers to open a file, run a command by id, and read a vault file.

The plugin build bundles Svelte and the shared code into `main.js`, so the released `main.js` only requires `obsidian`.

## Release

1. On a branch, run `npm version <patch|minor|major> --no-git-tag-version`. This updates `package.json`, `package-lock.json`, `manifest.json`, and `versions.json` (the `version` script copies the version and `minAppVersion`).
2. Commit the changes, open a PR, and merge it to `main`.
3. On the updated `main`, push a tag equal to the version, without a `v` prefix: `git tag 0.1.0 && git push origin 0.1.0`.

The `Release` workflow checks that the tag matches the versions, runs lint, typecheck, tests, and the build, attests build provenance, then publishes a GitHub Release with `main.js`, `manifest.json`, and `styles.css` attached.

## 概要（日本語）

Markdown のタスクリストをアウトラインとして編集するツールである。Obsidian プラグインとローカルで動く Web 版があり、編集処理と画面は共通である。絞り込み中もタスク・子タスク・ノートを追加して階層を編集でき、`- ![[work.md]]` のような埋め込み先へも書き戻す。ファイルは普通の Markdown のままなので、Git や他のエディタ、コーディングエージェントと同じファイルを扱える。

## License

[MIT](LICENSE)
