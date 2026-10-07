# Markdown Outliner

An outliner for Markdown task lists. It runs as an Obsidian plugin and as a small local web app, and both share the same editing core. Files stay plain Markdown, so they can be edited side by side with Git, other editors, and coding agents.

The user interface is currently in Japanese.

## Features

- Edit `- [ ]` / `- [/]` / `- [x]` tasks and plain bullets as an outline, with notes indented under each item.
- Filter by status, tags, and title text, and keep adding tasks, children, and notes while a filter is active. New tasks get the current status and tags.
- Change hierarchy with Tab / Shift+Tab, move items with Alt+Up/Down or drag and drop, and select several siblings to move or update them together.
- Zoom into an item, collapse items and embeds, and bookmark files and searches.
- Item-level embeds such as `- ![[work.md]]` are edited in place and saved back to the embedded file. Embeds are resolved relative to the embedding file's folder.
- Undo / Redo, auto-save about 0.8 seconds after the last edit, and conflict detection: if a file changed on disk, your input is kept instead of being overwritten.
- External changes are picked up every few seconds.

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

Open the outliner from the ribbon icon or the command "アウトライナーを開く" (open outliner). The plugin edits any `.md` file in the vault. Unsaved input is kept in memory while the plugin is enabled; save before quitting Obsidian or disabling the plugin. The plugin has been used on desktop; mobile has not been tested.

## Web version

Requires Node.js 24 or later.

```sh
npm ci
npm run build:web
node server.mjs [folder-or-file] [port]
```

Then open `http://127.0.0.1:<port>/` (default port 4317). Without arguments the server edits the bundled `samples/` folder in place, so copy it first if you want to keep the originals. Passing a single `.md` file restricts the server to that file. The server only listens on 127.0.0.1, serves the built app from `dist/web/`, and bookmarks are stored in the browser's local storage. `npm start` builds the web app and runs the server with the defaults.

## Development

The UI is written in Svelte 5 and TypeScript and built with Vite.

```sh
npm ci              # install the development tools
npm run dev         # Vite dev server with hot reload and the file API on http://127.0.0.1:5173/
npm run lint        # ESLint with eslint-plugin-obsidianmd and eslint-plugin-svelte
npm run typecheck   # svelte-check over src/ and the Vite configs
npm test            # run test:node and test:ui
npm run test:node   # core, row key, server and packaging tests with node --test
npm run test:ui     # screen tests (test/ui/) and Obsidian adapter tests with Vitest and jsdom
npm run build       # write dist/web/ and the plugin files dist/main.js, manifest.json, styles.css
```

`npm run dev` edits `samples/` by default; set `OUTLINER_WORKSPACE` to a folder or a single Markdown file to edit something else.

The screen tests drive the rendered DOM with keyboard and pointer events against an in-memory file adapter, and check the saved Markdown. CI runs lint, typecheck, `npm test` and `npm run build` on pull requests and on pushes to `main`.

Source layout:

- `src/core.ts`: Markdown parsing and editing operations, shared by both versions.
- `src/ui/`: the outliner UI, shared by both versions. `controller.svelte.ts` holds the editing state and operations, the `.svelte` files render it, and `mount.ts` mounts it into an element.
- `src/main.ts`: the Obsidian plugin entry point.
- `src/web/`: the standalone web page.
- `src/styles.css`: styles for both versions.
- `server.mjs`: the local web server and file API, also mounted by the dev server.
- `vite.config.ts`: the plugin build (a single CommonJS `main.js`).
- `vite.web.config.ts`: the web app build and dev server.
- `scripts/package-plugin.mjs`: builds the plugin and copies `manifest.json` and `styles.css` into `dist/`.

The plugin build bundles Svelte and the shared code into `main.js`, so the released `main.js` only requires `obsidian`.

## Release

1. Bump `version` in `manifest.json` and `package.json`.
2. Add the new version and its `minAppVersion` to `versions.json`.
3. Run `npm test` and `npm run build`.
4. Create a GitHub Release whose tag is exactly the version, without a `v` prefix (for example `0.1.0`).
5. Attach `dist/main.js`, `dist/manifest.json`, and `dist/styles.css` to the release.

## 概要（日本語）

Markdown のタスクリストをアウトラインとして編集するツールである。Obsidian プラグインとローカルで動く Web 版があり、編集処理と画面は共通である。絞り込み中もタスク・子タスク・ノートを追加して階層を編集でき、`- ![[work.md]]` のような埋め込み先へも書き戻す。ファイルは普通の Markdown のままなので、Git や他のエディタ、コーディングエージェントと同じファイルを扱える。

## License

[MIT](LICENSE)
