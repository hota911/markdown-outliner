# Changelog

All notable changes to Markdown Outliner are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- English user interface. The Obsidian plugin follows Obsidian's display language (Obsidian 1.8.7 or later), and the web version follows the browser language. Japanese is used for Japanese; every other language, and Obsidian before 1.8.7, gets English.
- Experimental: open a single Markdown file as an outline in its own tab with "Open as outline" in a `.md` file's menu or the command of the same name. The tab is titled with the file name, works with back and forward navigation, and is restored when Obsidian restarts. "Open as Markdown" in the tab's menu switches back to the regular editor. Renaming the open file keeps unsaved input.
- Touch screen support, in the web version and the Obsidian plugin alike. While an item's text or note has focus, a bar at the bottom of the outliner offers outdent, indent, move up and down, change status, switch between text and note, undo, and redo. Buttons and lines are larger, the row buttons appear only on the item being edited, and tapping the drag handle selects the item. Not yet tested on a real Android or iOS device or in the Obsidian mobile app.
- A command menu opened by typing `/` at the start of an item's text or after a space. It sets the status, turns a task into a bullet or back, opens the note, zooms in, moves the item to a file, or embeds an existing Markdown file picked from a list. Typing filters the commands in English or Japanese; Up/Down, Enter, Tab, Escape, clicks and taps work. A `/` inside a word, a full-width `／`, IME input and notes do not open it.
- Tag suggestions: typing `#` at the start of an item's text or after a space opens the same menu with the tags in use, filtered by what follows the `#`. In Obsidian these are the tags of the whole vault; in the web version, the tags in the files the outliner has read. Choosing one inserts the tag and a space.
- At 600px wide or narrower, the bookmarks stack above the outline instead of sitting beside it.

### Changed

- The status filter shows the same icons as the items: ○ Not started, ◐ In progress, ✓ Done, and ◌ Not done. "All" has no icon. Screen readers read the option names without the icons.
- The command and ribbon icon are named "Open outliner" in English and "アウトライナーを開く" in Japanese, following the display language.
- When a file changes on disk while it has unsaved input, changes on different lines are now merged automatically instead of being reported as a save conflict. The merge clears the undo history, and a message says so. If both sides changed the same line, the conflicting lines are listed as "Your input" and "External version", and "Keep my lines" or "Use external lines" picks one version for those lines.
- Enter with the cursor at the start of an item's text adds the new item above it instead of below, as in WorkFlowy and Logseq. The item keeps its note and children, and the cursor stays at its start. On an empty text, elsewhere in the text, or on the zoomed item, Enter works as before.

### Fixed

- External changes were never shown while a field kept its focus across a switch to another browser tab or window, and the status still said the file was saved. The status now says that a change is waiting, and the change is shown when you leave the field or return to the tab or window, with the cursor kept on the same item.
- Item titles wrapped after a few characters and the view scrolled horizontally in narrow panes such as an Obsidian tab, because hidden row buttons reserved space on every line. The buttons now float over the line on hover and appear below the line while you edit its title. Hidden buttons can no longer be clicked by accident.
- The bar for selected items (Not started / In progress / ...) wraps instead of overflowing at narrow widths.
- The outliner always opened `tasks.md` first, and listed it in the file picker even when the folder or vault had no such file. It now reopens the file shown last, or the first Markdown file in the list if that file is gone, and shows a message when there are no Markdown files. A file opened explicitly, such as an "Open as outline" tab or a single file given to the web server, still opens directly.
- The web server kept the page and the list of built files from startup, so after `npm run build:web` while it ran, the page loaded deleted files and failed until the server restarted. The page and its files are now read on each request, so reloading the browser picks up a new build. A request for a missing file returns 404 instead of 500.

## [0.1.2] - 2026-10-07

### Changed

- The minimum Obsidian version is now 1.7.2, because the plugin uses `Workspace.revealLeaf`.
- The outliner uses Obsidian's interface and monospace fonts.

### Fixed

- An outliner closed in a popout window kept checking its files for external changes.

## [0.1.1] - 2026-10-07

### Changed

- The plugin follows the colors of the Obsidian theme, including dark themes, instead of always using light colors. The web version follows the system's light or dark setting.

## [0.1.0] - 2026-10-07

### Added

- First release of the Obsidian plugin and the local web app, with a Japanese user interface.
- Edit `- [ ]` / `- [/]` / `- [x]` tasks and plain bullets as an outline, with notes under each item.
- Filter by status, tags, and title text, and keep adding tasks, children, and notes while a filter is active.
- Change the hierarchy with Tab / Shift+Tab, move items with Alt+Up/Down or drag and drop, and move or update several selected siblings together.
- Zoom into an item, collapse items and embeds, and bookmark files and searches.
- Edit item-level embeds such as `- ![[work.md]]` in place and save them back to the embedded file.
- Undo and redo, auto-save, and save conflict detection that keeps your input when the file changed on disk.

[Unreleased]: https://github.com/hota911/markdown-outliner/compare/0.1.2...HEAD
[0.1.2]: https://github.com/hota911/markdown-outliner/compare/0.1.1...0.1.2
[0.1.1]: https://github.com/hota911/markdown-outliner/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/hota911/markdown-outliner/releases/tag/0.1.0
