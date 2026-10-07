# Development tasks

- [ ] First release (0.1.0) #P1
  Make the plugin installable with BRAT from a GitHub Release first, then submit it to the community directory.
  - [ ] Follow the Plugin guidelines #P1
    Switching to getFileByPath and moving the title height into a CSS variable are done. createEl is not yet used. Theme variables are covered by "Match the theme colors".
  - [ ] Create a GitHub Release #P1
    The tag is exactly the version in manifest.json, without a `v` prefix. Attach main.js, manifest.json, and styles.css.
  - [ ] Submit to the community directory
    Add the plugin on community.obsidian.md after linking the GitHub account, and address the automated review.
- [ ] Apply external changes in a tab whose input has focus
  The page re-reads files every 3 seconds, but it defers external changes while an input has focus. Switching browser tabs keeps that focus, so when two tabs edit the same file the deferral never ends, and the status still shows 「保存済み」 (saved).
  Plan: while a change is deferred, say so in the status. When the tab becomes visible again and there is no unsaved input, apply the external change and restore the focus to the same item.
- [ ] Merge save conflicts automatically
  Compare the loaded version, the on-screen edits, and the file on disk. Apply non-overlapping changes automatically and show a diff for confirmation only when the same line changed. This requires keeping the full text as loaded.
- [ ] Check in Obsidian itself
  - [ ] IME composition, save conflicts, dragging an item under another, and editing alongside the regular Markdown editor
  - [ ] The status button in Safari and with touch input
  - [ ] Embedded files created with 「ファイルにする」 (move to a file)
- [ ] Screen tests for drag and drop
  jsdom cannot reproduce dragging, so these are marked todo in test/ui.
- [ ] Match the theme colors
  Colors in src/styles.css are fixed and set `color-scheme: light`, so the outliner stays white in Obsidian's dark mode and in other themes. Replace the colors with Obsidian's CSS variables, and define the same variables in light and dark sets for the web and Mac versions. Do not add a CSS framework: styles.css is loaded into all of Obsidian and would affect its own UI.
- [ ] Localization
  The UI text is Japanese only. Add English first. The Obsidian version follows Obsidian's display language.
- [ ] Obsidian integration
  - [ ] Open the outliner from the side menu
  - [ ] Open each file in its own tab
    How to switch automatically when a .md file is opened has not been investigated.
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
