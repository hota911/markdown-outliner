# Changelog

All notable changes to Markdown Outliner are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2026-10-08

### Added

- English user interface. The Obsidian plugin follows Obsidian's display language (Obsidian 1.8.7 or later), and the web version follows the browser language. Japanese is used for Japanese; every other language, and Obsidian before 1.8.7, gets English.
- Experimental: open a single Markdown file as an outline in its own tab with "Open as outline" in a `.md` file's menu or the command of the same name. The tab is titled with the file name, works with back and forward navigation, and is restored when Obsidian restarts. "Open as Markdown" in the tab's menu switches back to the regular editor. Renaming the open file keeps unsaved input.
- Touch screen support, in the web version and the Obsidian plugin alike. While an item's text or note has focus, a bar at the bottom of the outliner offers outdent, indent, move up and down, change status, switch between text and note, undo, and redo. Buttons and lines are larger, the row buttons appear only on the item being edited, and tapping the drag handle selects the item. Not yet tested on a real Android or iOS device or in the Obsidian mobile app.
- A command menu opened by typing `/` at the start of an item's text or after a space. It sets the status, turns a task into a bullet or back, opens the note, zooms in, moves the item to a file, or embeds an existing Markdown file picked from a list. Typing filters the commands in English or Japanese; Up/Down, Enter, Tab, Escape, clicks and taps work. A `/` inside a word, a full-width `／`, IME input and notes do not open it.
- Tag suggestions: typing `#` at the start of an item's text or after a space opens the same menu with the tags in use, filtered by what follows the `#`. In Obsidian these are the tags of the whole vault; in the web version, the tags in the files the outliner has read. Choosing one inserts the tag and a space.
- At 600px wide or narrower, the bookmarks stack above the outline instead of sitting beside it.
- Notes show inline Markdown while you are not editing them, as item texts already did for links. Both now render `[text](url)` links, bare http(s) URLs, `**bold**`, `*italic*` / `_italic_`, `` `code` ``, and `~~strikethrough~~`, and keep the line breaks of multi-line notes. Link targets other than http, https, and mailto stay plain text. Clicking the rendered text puts the cursor at the clicked character instead of at the end; at the end of a line it goes after closing markers such as `**`, so Enter there does not split the markup.
- Rename an embedded file with "Rename" below the embed heading: the file name in the heading becomes editable in place. Only the file name changes; the folder and `.md` stay. Enter renames the file and points the embed at the new name, and Escape cancels. An existing file is never overwritten, and the undo history is cleared. In Obsidian the rename goes through Obsidian, which updates links in other files as its settings say. The web version updates only the embed line that was used; other links to the old name are left as they are. Not available when the web server was started on a single file.
- Short animations (150ms): a new item, and the children shown by expanding an item or an embedded file, slide open; the bookmarks sidebar changes its width smoothly when collapsed or expanded. Opening a file or zooming does not animate the items, the new item has the focus at once, and with the system's reduced-motion setting nothing animates.
- `#tags` in an item's text and note are shown like links (in Obsidian, with the theme's tag colors), also inside bold, italic or strikethrough text. A tag is a whole word, as in the search box, so `**#tag**` stays plain bold text. Clicking or tapping a tag adds it to the search box filter, which applies right away; a tag already in the filter is not added again. Clicking elsewhere in the text starts editing with the caret where you clicked. While the text or note is being edited, ⌘-click (Ctrl-click on Windows and Linux) on a tag does the same.
- While the search box filters by words or `#tags`, the matched words and tags are highlighted in item titles, including inside bold, link and tag text. The highlight disappears while you edit the title.
- Experimental: a macOS desktop app built with Tauri 2 (`npm run build:tauri`). It opens a folder and edits its Markdown files with the same checks as the web server. It is unsupported and may change or be removed; it is built from source only and not attached to releases.

### Changed

- The status filter shows the same icons as the items: ○ Not started, ◐ In progress, ✓ Done, and ◌ Not done. "All" has no icon. Screen readers read the option names without the icons.
- The command and ribbon icon are named "Open outliner" in English and "アウトライナーを開く" in Japanese, following the display language.
- When a file changes on disk while it has unsaved input, changes on different lines are now merged automatically instead of being reported as a save conflict. The merge clears the undo history, and a message says so. If both sides changed the same line, the conflicting lines are listed as "Your input" and "External version", and "Keep my lines" or "Use external lines" picks one version for those lines.
- An expanded embed no longer repeats its file name as "File: …" under the heading, which already shows it.
- Bookmarks save the current view: "Add current view" (formerly "Add file") and the star in the filter box store the file together with the status filter, the words and #tags, and the zoomed item, and opening the bookmark restores all of them. The zoomed item is found again by its title, so it survives edits that move it; if no item has that title any more, the whole file is shown with a message. The same view cannot be bookmarked twice. Bookmarks can be renamed with ✎ (Enter saves, Escape cancels, an empty name goes back to the name derived from the view). File and search bookmarks saved by earlier versions keep working unchanged.
- Enter with the cursor at the start of an item's text adds the new item above it instead of below, as in WorkFlowy and Logseq. The item keeps its note and children, and the cursor stays at its start. On an empty text, elsewhere in the text, or on the zoomed item, Enter works as before.
- Embed lines (`- ![[file.md]]`) now move like items. They have a drag handle: drag it, press Alt+↑ / Alt+↓ on it, or select the line and use the selection's move buttons. Items can be dragged before and after an embed, and an embed can be put under an item, but nothing can be put under an embed. Embed lines move only within their file, and the embedded file is not changed.
- While a status or search filter is active, an item that does not match but has a matching item under it is shown dimmed, so that the matches keep their place in the outline. Screen readers announce it as shown because an item under it matches. Dimmed items can be edited as usual.

### Fixed

- External changes were never shown while a field kept its focus across a switch to another browser tab or window, and the status still said the file was saved. The status now says that a change is waiting, and the change is shown when you leave the field or return to the tab or window, with the cursor kept on the same item.
- Item titles wrapped after a few characters and the view scrolled horizontally in narrow panes such as an Obsidian tab, because hidden row buttons reserved space on every line. The buttons now float over the line on hover and appear below the line while you edit its title. Pressing a row button leaves the focus where it is, so the buttons stay put and one click or tap runs the command; Tab still reaches them. Hidden buttons can no longer be clicked by accident.
- Enter at the end of a note did nothing: the new empty line was removed as soon as it was typed, and text typed next stayed on the same line. The new line now stays while you edit the note; empty lines left at its end are not saved.
- The bar for selected items (Not started / In progress / ...) wraps instead of overflowing at narrow widths.
- The outliner always opened `tasks.md` first, and listed it in the file picker even when the folder or vault had no such file. It now reopens the file shown last, or the first Markdown file in the list if that file is gone, and shows a message when there are no Markdown files. A file opened explicitly, such as an "Open as outline" tab or a single file given to the web server, still opens directly.
- The web server kept the page and the list of built files from startup, so after `npm run build:web` while it ran, the page loaded deleted files and failed until the server restarted. The page and its files are now read on each request, so reloading the browser picks up a new build. A request for a missing file returns 404 instead of 500.
- While a status or search filter was active, an embedded file was always shown, even with nothing matching inside, and without its parent items when they did not match, so it appeared under the wrong item. An embed is now shown only when something in the embedded file matches, with its parents dimmed.

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

[Unreleased]: https://github.com/hota911/markdown-outliner/compare/0.1.3...HEAD
[0.1.3]: https://github.com/hota911/markdown-outliner/compare/0.1.2...0.1.3
[0.1.2]: https://github.com/hota911/markdown-outliner/compare/0.1.1...0.1.2
[0.1.1]: https://github.com/hota911/markdown-outliner/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/hota911/markdown-outliner/releases/tag/0.1.0
