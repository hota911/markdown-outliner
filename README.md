English | [日本語](README.ja.md)

# Markdown Outliner

An outliner for Markdown task lists. It runs as an Obsidian plugin and as a small local web app, and both share the same editing core. Files stay plain Markdown, so they can be edited side by side with Git, other editors, and coding agents.

The user interface is available in English and Japanese. The Obsidian plugin follows Obsidian's display language (Obsidian 1.8.7 or later; older versions use English), and the web version follows the browser language. Any other language falls back to English.

## Features

- Edit `- [ ]` / `- [/]` / `- [x]` tasks and plain bullets as an outline, with notes indented under each item.
- Item texts and notes show basic inline Markdown while you are not editing them: `[text](url)` links (http, https, and mailto), bare http(s) URLs, `**bold**`, `*italic*` / `_italic_`, `` `code` ``, and `~~strikethrough~~`. Links open in a new tab, and clicking elsewhere on the text edits the raw Markdown with the cursor at the clicked character.
- Filter by status, tags, and title text, and keep adding tasks, children, and notes while a filter is active. New tasks get the current status and tags. `#tags` in item texts and notes are shown like links, also inside bold or italic text; click one to add it to the filter (while editing, ⌘-click, or Ctrl-click on Windows and Linux).
- Change hierarchy with Tab / Shift+Tab, move items with Alt+Up/Down or drag and drop, and select several siblings to move or update them together.
- Zoom into an item, collapse items and embeds, and bookmark the current view (file, filters and zoom) under a name of your choice. The bookmarks sidebar stays in place while the outline scrolls, and scrolls by itself when the list is long.
- Type `/` at the start of an item's text or after a space to open a command menu: set the status, turn a task into a bullet or back, open the note, zoom in, collapse or expand the item's children, move the item to a file, or embed an existing file. Collapse is offered only for an expanded item with children and Expand only for a collapsed one; the focus stays in the item's text. The text after `/` filters the commands by their English or Japanese name; Up/Down pick one, Enter, Tab or a click runs it and removes the `/` text, and Escape closes the menu and keeps the text. A `/` inside a word (`A/B`, URLs), a full-width `／`, a `/` typed with an IME, and notes do not open the menu. For "Embed existing file", the menu lists the other Markdown files to pick from; an empty item becomes the embed, otherwise the embed is added below the item. One Undo restores the item with the `/` text.
- Type `#` the same way to pick a tag already in use. In Obsidian the menu lists the tags of the whole vault (from Obsidian's metadata cache, including frontmatter tags) plus those in the files the outliner has read; in the web version it lists the `#tags` in the files the outliner has read since it was opened (the files shown and their embeds), not every file in the folder. The text after `#` filters the tags, ignoring case and katakana/hiragana and full-/half-width differences; tags starting with it come first. Enter, Tab or a click replaces `#text` with the tag and a space. Without a match the menu closes, so a new tag is typed as usual.
- Headings (`#` to `######` at the start of a line) are shown as read-only rows, with the unindented items of their section and deeper headings under them. Fold or zoom into a heading, and use its + button to add the first item of its section. Alt+Up/Down on the first or last item of a section, and dragging an item onto a heading or next to an item of another section, move it into that section. Only the moved lines change; paragraphs and other text keep their place, and a move that would make them part of an item is refused. Headings themselves cannot be renamed, added, deleted, or moved in the outliner.
- Item-level embeds such as `- ![[work.md]]` are edited in place and saved back to the embedded file. Embeds are resolved relative to the embedding file's folder.
- Rename an embedded file from its embed header. The web version updates only that embed line, not other links to the file; Obsidian updates links as its settings say.
- Undo / Redo, auto-save about 0.8 seconds after the last edit, and conflict handling: if a file changed on disk while you were editing it, changes to different lines are merged automatically (this clears the undo history). If both sides changed the same line, your input is kept and the differing lines are shown so you can choose which version to use there.
- External changes are picked up every few seconds. While a field has focus, the status says that a change is waiting, and the change is shown when you leave the field or come back to the tab or window, with the cursor kept on the same item.

Paragraphs, code blocks, and other content that is neither a heading nor a list item are preserved but not shown.

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
- The `/` command menu works with a tap on a command; its rows are 36px high.
- Buttons are at least 36px high, the keyboard shortcut help is hidden, and on screens 600px wide or narrower the bookmarks are shown above the outline, at most 40% of the screen high, and a longer list scrolls inside them.

The touch layout is tested in Chromium emulating a Pixel 7 (`e2e/mobile.spec.ts`). It has not been checked on a real Android or iOS device or in the Obsidian mobile app.

## Agent skill

The repository includes an Agent Skills skill, [`skills/markdown-outliner/`](skills/markdown-outliner/SKILL.md), that tells coding agents such as Claude Code, Codex, Cursor and Gemini CLI how these files are structured, so that their edits keep items, nesting, statuses, notes, tags and embeds intact. Install it with the [`skills`](https://github.com/vercel-labs/skills) CLI:

```sh
npx skills add hota911/markdown-outliner
```

Alternatively, copy the `skills/markdown-outliner/` folder into your agent's skills folder, such as `~/.claude/skills/` for Claude Code or `.agents/skills/` in a project. The skill's examples are checked against the outliner's parser and editing operations by `test/skill.test.mjs`.

## Web version

Requires Node.js 24 or later.

```sh
npm ci
npm run build:web
node server.mjs [folder-or-file] [port]
```

Then open `http://127.0.0.1:<port>/` (default port 4317). Without arguments the server edits the bundled `samples/` folder in place, so copy it first if you want to keep the originals. Passing a single `.md` file restricts the server to that file. For a folder, the page opens the file shown last, or the first Markdown file of the folder. The server only listens on 127.0.0.1, serves the built app from `dist/web/`, and bookmarks and the file shown last are stored in the browser's local storage. `npm start` builds the web app and runs the server with the defaults.

## Desktop app (experimental)

Experimental: the desktop app is unsupported, and it may change or be removed in any version. It is not part of the releases, and the web version and the Obsidian plugin do not depend on it.

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

The UI is written in Svelte 5 and TypeScript and built with Vite. Open development tasks are listed in [TODO.md](TODO.md). [AGENTS.md](AGENTS.md) lists what to run and check before opening a pull request, for contributors and coding agents.

```sh
npm ci              # install the development tools
npm run dev         # Vite dev server with hot reload and the file API on http://127.0.0.1:5173/
npm run demo        # build the web app and serve a temporary copy of samples/ on a free port
npm run dev:plugin  # watch mode: rebuild the Obsidian plugin into $OBSIDIAN_VAULT/.obsidian/plugins/markdown-outliner/
npm run lint        # ESLint with eslint-plugin-obsidianmd and eslint-plugin-svelte
npm run typecheck   # svelte-check over src/, e2e/, obsidian-e2e/ and the Vite and Playwright configs
npm test            # run test:node and test:ui
npm run test:node   # core, row key, server and packaging tests with node --test
npm run test:ui     # screen tests (test/ui/) and Obsidian adapter tests with Vitest and jsdom
npm run test:e2e    # build the web app and the preview, then run the browser tests (e2e/) in Chromium with Playwright, on desktop and as a Pixel 7
npm run test:obsidian # build the plugin, then test it inside the Obsidian desktop app (obsidian-e2e/)
npm run test:perf   # time editing operations on large files and check that time grows linearly with the file size
npm run build       # write dist/web/ and the plugin files dist/main.js, manifest.json, styles.css
npm run build:preview # write dist/preview/markdown-outliner-preview.html, the web app on the files of samples/ in one file
```

`npm run dev` edits `samples/` by default; set `OUTLINER_WORKSPACE` to a folder or a single Markdown file to edit something else.

`npm run demo` copies `samples/` to a new temporary folder and serves the copy with `server.mjs`, so edits never reach `samples/`. It prints the folder and the URL. `npm run demo -- <folder-or-file> [port]` copies another folder or Markdown file instead, and serves it on the given port.

`npm run dev:plugin` loads the in-progress build into Obsidian. Set `OBSIDIAN_VAULT` to the path of a vault (a folder with `.obsidian/`); the script exits with a message if it is unset or the folder is not a vault. It rebuilds `main.js` on every source change and copies `manifest.json` and `styles.css` next to it. Obsidian does not notice the new files by itself: install the [Hot Reload](https://github.com/pjeby/hot-reload) community plugin and add an empty `.hotreload` file to the plugin folder so it reloads on change, or toggle Markdown Outliner off and on in Obsidian's community plugin settings after each build.

The screen tests drive the rendered DOM with keyboard and pointer events against an in-memory file adapter, and check the saved Markdown. jsdom has no layout or drag and drop, so dragging is tested with Playwright instead: each test in `e2e/` writes a Markdown file to a temporary folder, starts `server.mjs` on it, drags with the mouse in Chromium, and checks the file on disk. `npm test` does not include these tests because they need a browser. Before the first run, download Chromium with `npx playwright install chromium`.

`npm run test:obsidian` tests the built plugin inside the Obsidian desktop app. It uses the executable set in `OBSIDIAN_EXECUTABLE`, or on macOS `/Applications/Obsidian.app/Contents/MacOS/Obsidian`; when the variable is unset and that file does not exist, the tests are skipped. Each test starts a separate Obsidian process with a new temporary profile (`--user-data-dir`) and a temporary vault copied from `samples/`, then deletes both, so it never reads or changes your Obsidian settings, vaults, or a running Obsidian. Playwright attaches to the window over the DevTools protocol. The tests check that the plugin loads without console errors; that the ribbon icon and the commands open the outliner and the per-file outline view; that edits, status changes and drag and drop are saved to the file; that "Open as Markdown" switches back and the outline tab is restored after a restart; that the text follows the light and dark themes; that a long bookmark name wraps inside its button and the bookmarks sidebar scrolls apart from the outline; and that the labels are Japanese when Obsidian's language is Japanese. The test vault turns off native menus so Playwright can click Obsidian's menus. On macOS the tests start Obsidian in the background (`open -g`) and, before its window first appears, make the window transparent, click-through and unable to take keyboard focus, and make Obsidian a background-only app (Electron's `app.setActivationPolicy('prohibited')`). Without that last step Obsidian makes itself the active app about half a second after each launch, and what you are typing goes to it for a moment. So the tests neither take the focus nor show a window; Obsidian appears in the Dock only for a moment at each launch. Set `OBSIDIAN_E2E_HEADED=1` to see the window, for example to debug a failing test; Obsidian then opens in the foreground. These tests are not part of `npm test` or `npm run test:e2e`.

CI runs lint, typecheck, `npm test`, `npm run test:e2e` and `npm run build` on pull requests and on pushes to `main`. A separate workflow (`.github/workflows/tauri.yml`) runs the Rust tests of the desktop app on macOS only when `src-tauri/` or `package.json` changes; it is not a required check, because a macOS runner and a cold Tauri build take several minutes. Another workflow (`.github/workflows/obsidian.yml`) runs `npm run test:obsidian` on Linux under a virtual X display (Xvfb) with the Linux build of Obsidian, downloaded from [the official releases](https://github.com/obsidianmd/obsidian-releases/releases) at a pinned version and checked against its SHA-256. It is not a required check either: it depends on downloading Obsidian, which is not open source. To update Obsidian, change `OBSIDIAN_VERSION` and `OBSIDIAN_SHA256` in that workflow.

### Pull request preview

`npm run build:preview` builds the web app without the server as one HTML file, `dist/preview/markdown-outliner-preview.html`, with the script and the styles inlined. The files of `samples/` are embedded at build time and kept in memory (`src/preview/adapter.ts`), so edits work but a reload starts again from the samples, and bookmarks are not kept. The file needs no server: open it in a browser from disk. `e2e/preview.spec.ts` opens it from `file://` and checks that it loads nothing else, saves an edit, and resets on reload.

On each pull request, `.github/workflows/preview.yml` builds the file and uploads it unzipped as an artifact of the run, then posts or updates one comment on the pull request with the link to it. The link needs a GitHub login. A pull request from a fork has no token that can comment, so the link is only in the job summary of the run.

Source layout:

- `src/core.ts`: Markdown parsing and editing operations, shared by both versions.
- `src/ui/`: the outliner UI, shared by both versions. `controller.svelte.ts` holds the editing state and operations, the `.svelte` files render it, and `mount.ts` mounts it into an element.
- `src/obsidian/`: the Obsidian plugin entry point (`main.ts`).
- `src/web/`: the standalone web page.
- `src/tauri/`: the page of the desktop app; `adapter.ts` calls the Rust commands.
- `src/preview/`: the pull request preview page; `adapter.ts` keeps the files of `samples/` in memory.
- `src-tauri/`: the desktop app. `src/workspace.rs` is the file access ported from `server.mjs`, with its tests; `src/lib.rs` has the commands, the folder dialog, the menu and the window.
- `src/styles.css`: styles for both versions. Colors and fonts use Obsidian's theme variables, so the plugin follows the Obsidian theme; `src/web/theme.css` defines them for the web page in light and dark sets that follow the system setting.
- `server.mjs`: the local web server and file API, also mounted by the dev server.
- `skills/markdown-outliner/`: the agent skill for editing these files, not part of the plugin or the web build.
- `vite.config.ts`: the plugin build (a single CommonJS `main.js`).
- `vite.web.config.ts`: the web app build and dev server.
- `vite.tauri.config.ts`: the desktop app's page build and dev server.
- `vite.preview.config.ts`: the pull request preview build, with the script and the styles inlined into the page.
- `scripts/package-plugin.mjs`: builds the plugin and copies `manifest.json` and `styles.css` into `dist/`.
- `scripts/demo.mjs`: serves a temporary copy of `samples/` for `npm run demo`.
- `scripts/perf-compare.mjs`: compares a pull request's speed with its base's in CI; see [Performance](#performance).
- `scripts/changelog-section.mjs`: prints one version's section of `CHANGELOG.md`, used as the release notes.
- `.changie.yaml`, `.changes/`: the Changie configuration, the unreleased changelog fragments, and the released versions that CHANGELOG.md is generated from.
- `e2e/`: Playwright tests in Chromium (drag and drop, layout, and the touch screen layout in `mobile.spec.ts`); `playwright.config.ts` runs `mobile.spec.ts` as a Pixel 7 and the rest as desktop Chrome.
- `obsidian-e2e/`: Playwright tests of the plugin in the Obsidian desktop app, with their own `playwright.config.ts`; `fixtures.ts` starts Obsidian and has helpers to open a file, run a command by id, and read a vault file.

The plugin build bundles Svelte and the shared code into `main.js`, so the released `main.js` only requires `obsidian`.

### Performance

`npm run test:perf` times eight operations on generated outlines of 17,000 and 34,000 items (`test/large-outline.ts`, about 1MB and 2MB): opening a file, typing in a title, indenting and moving an item, merging a change made outside the outliner, resolving a conflict, and filtering by words, by a tag and by a status (`test/perf-operations.mjs`). Each operation runs in a Node process of its own, which collects garbage before each run, and the median of 7 runs after 2 warm-up runs is its time. The test fails when an operation takes 3 times as long or more on the file twice as large (a linear operation takes about twice as long, a quadratic one four times), or more than one second on the larger file. These checks do not depend on earlier results and also run in CI. The run takes about 10 seconds; `npm test` does not include it, so that tests running in parallel do not disturb the timings.

The Performance workflow (`.github/workflows/perf.yml`) runs on pull requests and on pushes to `main`. It is not a required check.

- On a pull request, `scripts/perf-compare.mjs` checks out the base commit next to the pull request and times each operation on the larger file 6 times on each side, alternating between the two on the same runner. Times on shared runners vary from job to job, much more than within one job: in October 2026, comparing a commit with itself gave ratios between 0.95 and 1.07, while the same commit took up to 1.7 times as long in one job as in another. So the pull request is compared with its base measured in the same job, not with earlier runs. There are two lines, `WARNING_RATIO` and `FAILING_RATIO` at the top of the script:
  - Warning: the pull request's median is at least 1.3 times the base's.
  - Failure: at least 2 times. The job fails.

  Either counts only when the Mann-Whitney U test finds the difference significant (p below 0.05 divided by the 8 operations), so that a single slow run does not trigger it. The report, with the base and head medians, their ratio and p for each operation, is in the job summary. On a warning or a failure, the workflow also posts it as a comment on the pull request, and updates that one comment on later pushes; pull requests from forks get only the job summary. The `npm run test:perf` checks run in the same job and fail it on their own.

  To compare locally, check out the base in another folder and pass it: `git worktree add --detach ../base main`, then `node scripts/perf-compare.mjs ../base`. The script overwrites the base's `test/perf-operations.mjs` and `test/large-outline.ts` with this checkout's, so both sides run the same benchmark.
- On each push to `main`, the times on both file sizes are added to a history in the `gh-pages` branch with [github-action-benchmark](https://github.com/benchmark-action/github-action-benchmark): `dev/bench/data.js` holds one entry per commit, and `dev/bench/index.html` draws a chart for each operation. With GitHub Pages serving the `gh-pages` branch, the charts are at <https://hota911.github.io/markdown-outliner/dev/bench/>. To find the commit where an operation got slower, look for the step in its chart: hovering over a point shows its commit, and clicking it opens the commit on GitHub. When a commit takes at least twice as long as the previous one, the workflow also comments on the commit; it does not fail, because consecutive commits run on different runners.

## Changelog

[CHANGELOG.md](CHANGELOG.md) follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and is generated by [Changie](https://changie.dev) (a pinned dev dependency, run with `npx changie`). Do not edit CHANGELOG.md directly: `npm test` fails if it differs from what `npx changie merge` builds from `.changes/`.

- A pull request with a user-facing change adds a fragment to `.changes/unreleased/` with `npx changie new` (pick the kind: Added, Changed, Deprecated, Removed, Fixed, or Security; write the entry as one line, in the same style as the existing entries). `npx changie new --kind Fixed --body "..." --interactive=false` does the same without prompts. Each change is its own file, so parallel pull requests do not conflict.
- A fix or change to something not released yet edits that feature's fragment in `.changes/unreleased/` instead of adding a Fixed or Changed entry, so the release notes describe only what users of the previous release will see change.
- Changes that only affect development, such as tests, CI, or dependency updates that do not reach the released files, need no fragment.
- Released versions live in `.changes/<version>.md`. To correct the notes of a release, edit that file and run `npx changie merge`. `.changes/header.tpl.md` is the text above the versions.

User-facing changes also update both README.md and README.ja.md.

## Release

1. On a branch from the latest `main`, run `npm version <patch|minor|major> --no-git-tag-version`. This updates `package.json` and `package-lock.json`, and the `version` script then copies the version into `manifest.json` and `versions.json` (with `minAppVersion`), collects the fragments in `.changes/unreleased/` into `.changes/X.Y.Z.md` dated today (`changie batch`), and regenerates CHANGELOG.md (`changie merge`). `npm test` fails if CHANGELOG.md has no entries for the version in `package.json`.
2. Review the new section of CHANGELOG.md. To adjust it, edit `.changes/X.Y.Z.md` and run `npx changie merge`.
3. Commit the changes, including the deleted fragments, open a PR, and merge it to `main`.
4. On the updated `main`, push a tag equal to the version, without a `v` prefix: `git tag 0.1.0 && git push origin 0.1.0`.

The `Release` workflow checks that the tag matches the versions, runs lint, typecheck, tests, and the build, attests build provenance, then publishes a GitHub Release with `main.js`, `manifest.json`, and `styles.css` attached. The release notes are the tag's section of CHANGELOG.md (`node scripts/changelog-section.mjs <version>` prints it); the workflow fails if that section is missing or empty.

## License

[MIT](LICENSE)
