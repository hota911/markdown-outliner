# Development tasks

- [ ] First release (0.1.0) #P1
  Make the plugin installable with BRAT from a GitHub Release first, then submit it to the community directory.
  - [x] Follow the Plugin guidelines #P1
    Audited against the guidelines and submission requirements: minAppVersion raised to 1.7.2 for `revealLeaf`, typings updated so lint checks API versions, fonts use theme variables, and the poll timer is cleared on its own window.
  - [x] Create a GitHub Release #P1
    [0.1.0](https://github.com/hota911/markdown-outliner/releases/tag/0.1.0), published on 2026-10-07 by the Release workflow from a pushed tag.
  - [ ] Submit to the community directory
    Submit after using it personally for a while; until then releases stay at 0.1.x (decided 2026-10-07).
    Add the plugin on community.obsidian.md after linking the GitHub account, and address the automated review. Entry for community-plugins.json:
    `{"id": "markdown-outliner", "name": "Markdown Outliner", "author": "hota911", "description": "Edit Markdown task lists as an outline, keep adding and restructuring tasks while filtering, and write changes back to embedded files.", "repo": "hota911/markdown-outliner"}`
- [ ] Apply external changes in a tab whose input has focus
  The page re-reads files every 3 seconds, but it defers external changes while an input has focus. Switching browser tabs keeps that focus, so when two tabs edit the same file the deferral never ends, and the status still shows 「保存済み」 (saved).
  Plan: while a change is deferred, say so in the status. When the tab becomes visible again and there is no unsaved input, apply the external change and restore the focus to the same item.
- [ ] Merge save conflicts automatically
  Compare the loaded version, the on-screen edits, and the file on disk. Apply non-overlapping changes automatically and show a diff for confirmation only when the same line changed. This requires keeping the full text as loaded.
- [ ] Check in Obsidian itself
  - [ ] IME composition, save conflicts, dragging an item under another, and editing alongside the regular Markdown editor
  - [ ] The status button in Safari and with touch input
  - [ ] Embedded files created with 「ファイルにする」 (move to a file)
- [x] Screen tests for drag and drop
  jsdom cannot reproduce dragging, so these run in Chromium with Playwright (`e2e/`, `npm run test:e2e`).
- [x] Match the theme colors
  Done in 0.1.1: src/styles.css uses Obsidian's CSS variables and no longer sets `color-scheme: light`. The web version defines the same variables in light and dark sets in src/web/theme.css. A Mac version would reuse that file.
- [x] Localization
  English and Japanese messages live in src/ui/messages.ts; Obsidian follows its display language (1.8.7+, otherwise English) and the web version follows the browser language.
- [ ] Obsidian integration
  - [ ] Open the outliner from the side menu
  - [x] Open each file in its own tab
    Experimental: "Open as outline" in the file menu and as a command opens a tab bound to one file (view type `markdown-outliner-file`); "Open as Markdown" in the tab's menu switches back. Not yet checked in Obsidian itself.
  - [ ] Switch a .md file to the outline automatically
    How to switch automatically when a .md file is opened (for example by frontmatter) has not been investigated.
- [ ] Mac app
  - [ ] Add a Mac app version
  - [ ] Distribute the Mac app
- [ ] Future features
  Not yet specified.
  - [ ] Add block IDs (`^id`) only to the items that need them
  - [ ] Pomodoro (write estimates, run timers, sum the estimates)
  - [ ] Archive
    Move completed tasks to another file, for example from TODO.md to TODO.archived.md.
  - [ ] A skill and an MCP server for task management
