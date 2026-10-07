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

Requires Node.js (no dependencies to install).

```sh
node server.mjs [folder-or-file] [port]
```

Then open `http://127.0.0.1:<port>/` (default port 4317). Without arguments the server edits the bundled `samples/` folder in place, so copy it first if you want to keep the originals. Passing a single `.md` file restricts the server to that file. The server only listens on 127.0.0.1, and bookmarks are stored in the browser's local storage. `npm start` runs the server with the defaults.

## Development

```sh
npm test        # run all tests with node --test
npm run build   # write main.js, manifest.json, styles.css to dist/
```

Source layout:

- `src/core.js`: Markdown parsing and editing operations, shared by both versions.
- `src/ui.js`: the outliner UI, shared by both versions.
- `src/main.js`: the Obsidian plugin entry point.
- `src/styles.css`: styles for both versions.
- `server.mjs`: the local web server.
- `scripts/package-plugin.mjs`: bundles the plugin into `dist/`.

The build inlines `core.js` and `ui.js` into `main.js`, so the released `main.js` only requires `obsidian`.

## Release

1. Bump `version` in `manifest.json` and `package.json`.
2. Add the new version and its `minAppVersion` to `versions.json`.
3. Run `npm test` and `npm run build`.
4. Create a GitHub Release whose tag is exactly the version, without a `v` prefix (for example `0.2.1`).
5. Attach `dist/main.js`, `dist/manifest.json`, and `dist/styles.css` to the release.

## 概要（日本語）

Markdown のタスクリストをアウトラインとして編集するツールである。Obsidian プラグインとローカルで動く Web 版があり、編集処理と画面は共通である。絞り込み中もタスク・子タスク・ノートを追加して階層を編集でき、`- ![[work.md]]` のような埋め込み先へも書き戻す。ファイルは普通の Markdown のままなので、Git や他のエディタ、コーディングエージェントと同じファイルを扱える。

## License

[MIT](LICENSE)
