---
name: markdown-outliner
description: Read and edit Markdown files used with Markdown Outliner (the Obsidian plugin and local web app) without breaking their outline. Use when a Markdown file is a nested task list with `- [ ]` / `- [/]` / `- [x]` items, indented notes under items, `#tags`, or `- ![[file.md]]` embed lines, or when the user says the file is opened in Markdown Outliner.
---

# Markdown Outliner files

Markdown Outliner shows the list items of a plain Markdown file as an outline. It edits the file line by line: it rewrites only the lines an edit touches and keeps everything else byte for byte, including headings, paragraphs, code blocks, frontmatter, blank lines, and CRLF line endings. A file stays valid for the outliner as long as its list lines follow the rules below.

## The format

```markdown example
# Tasks

- [/] Write the weekly report #work
  Outline first, then write.
  - [ ] Collect numbers #work
  - [x] Pick the main message
- [ ] Clean the desk #home
- Ideas
  - Try a standing desk
- ![[work.md]]
```

- Item: a line `<indent><marker> <title>`. The marker is `-`, `*`, or `+`, followed by exactly one space. Numbered lines (`1.`) are not items.
- Status: an optional box right after the marker, followed by one space. `[ ]` is not started, `[/]` is in progress, `[x]` (or `[X]`) is done. Without a box the item is a plain bullet, which has no status. Any other box, such as `[-]` or `[>]`, is not a status: the item is a bullet whose title starts with `[-]`.
- Nesting: one level is 2 spaces or one tab (a tab counts as 2 columns). An item belongs to the closest item above it with less indentation. An item whose indentation is an odd number of columns is not an item.
- Title: the rest of the line, one line only.
- Note: the lines directly under an item, before its first child, indented 2 columns deeper than the item. A note can span several lines and contain blank lines between its lines.
- Tags: `#tag` at the start of a title or note or after whitespace. A tag runs over letters, digits, `_`, `-`, and `/` (nested tags such as `#priority/high`), and is not only digits. `a#b`, `**#tag**`, and full-width `＃` are not tags.
- Embed: an item whose whole title is `![[path.md]]`, written as `- ![[path.md]]` with no status box. The path is relative to the folder of the file that contains the line; absolute paths, URLs, and paths that leave the outliner's folder or vault are errors. The outliner shows and edits the embedded file's items in place.
- Everything else (headings, paragraphs, tables, frontmatter at the top, fenced code blocks, numbered lists) is kept but not shown. List lines inside frontmatter or code fences are not items. A line of non-list text that starts at column 0 ends the outline above it: the items after it are not children of any item above it.

The outliner shows `[text](url)` links (http, https, mailto), bare http(s) URLs, `**bold**`, `*italic*` / `_italic_`, `` `code` ``, and `~~strike~~` in titles and notes. `[[wiki links]]` are kept but shown as plain text.

## Rules for edits

- Edit the lines you need and leave the rest of the file as it is. Do not reformat, re-indent, or re-wrap other lines, and keep the file's line endings.
- New lines use `-` and 2 spaces per level. A child is exactly one level (2 spaces) deeper than its parent, and a note is 2 spaces deeper than its item.
- Put a note directly under its item, before any child. Text placed after the children belongs to no item and disappears from the outline.
- Move an item together with its note and all its descendants, and shift every line of the moved block by the same amount.
- Keep the outline contiguous. The outliner refuses to move items across headings or other non-list text, so do not split one list with text unless it is meant to be separate.
- Statuses are `[ ]`, `[/]`, `[x]`. Write `x` in lower case. Add or remove the box to turn a bullet into a task or back.
- Do not add a status box, a note, or children to an embed line. The outliner does not let anything be put under an embed line, and it does not show a note under one.
- The file may be open in the outliner while you edit it. It picks up external changes every few seconds and merges them line by line with unsaved input; if both changed the same line, the user has to pick a version. Small, line-level edits keep that merge clean.

## Common edits

Add a task after an item. It goes after the item's note and children, at the item's indentation:

```markdown before:add-sibling
- [ ] Write the report #work
  Outline first.
  - [ ] Collect numbers
- [ ] Clean the desk
```

```markdown after:add-sibling
- [ ] Write the report #work
  Outline first.
  - [ ] Collect numbers
- [ ] Book flights
- [ ] Clean the desk
```

Add a child. The outliner adds a new child as the first child, after the note:

```markdown before:add-child
- [ ] Write the report #work
  Outline first.
  - [ ] Collect numbers
```

```markdown after:add-child
- [ ] Write the report #work
  Outline first.
  - [ ] Draft the summary
  - [ ] Collect numbers
```

Change a status. Only the box changes:

```markdown before:change-status
- [ ] Write the report #work
  - [/] Collect numbers
```

```markdown after:change-status
- [/] Write the report #work
  - [x] Collect numbers
```

Add a note. It goes right under the item, 2 spaces deeper than the item:

```markdown before:add-note
- [ ] Write the report #work
  - [ ] Collect numbers
```

```markdown after:add-note
- [ ] Write the report #work
  - [ ] Collect numbers
    Ask finance for the Q3 sheet.
```

Move a subtree under another item, as its last child. The item, its note, and its children move together and each line is indented by the same amount:

```markdown before:move-subtree
- [ ] Prepare the trip
  - [ ] Book flights
- [ ] Pack
  Check the weather first.
  - [ ] Charger
```

```markdown after:move-subtree
- [ ] Prepare the trip
  - [ ] Book flights
  - [ ] Pack
    Check the weather first.
    - [ ] Charger
```

Embed another file. The embed line is a sibling of the item, after its note and children:

```markdown before:embed-file
- [ ] Plan the release
  - [ ] Write notes
- [ ] Tag the version
```

```markdown after:embed-file
- [ ] Plan the release
  - [ ] Write notes
- ![[release/checklist.md]]
- [ ] Tag the version
```

## Pitfalls

A note written after the children belongs to no item. The outliner keeps the line but does not show it:

```markdown pitfall:note-after-children
- [ ] Write the report
  - [ ] Collect numbers
  This line is lost from the outline.
```

Odd indentation does not make a child. Here `Collect numbers` becomes note text of `Write the report`, and the outliner then refuses to edit that note:

```markdown pitfall:odd-indent
- [ ] Write the report
   - [ ] Collect numbers
```

Only `[ ]`, `[/]`, `[x]`, and `[X]` are statuses. These are bullets whose titles start with the box:

```markdown pitfall:unknown-status
- [-] Cancelled
- [>] Deferred
```

An empty task is `- [ ] ` with a space after `]`. A tool that strips trailing whitespace turns it into a bullet titled `[ ]`:

```markdown pitfall:empty-task
- [ ]
```

Only the exact form `- ![[path.md]]` is an embed. A missing `.md`, a heading or block reference, or other text on the line makes a normal bullet:

```markdown pitfall:not-embed
- ![[work]]
- ![[work.md#Heading]]
- See ![[work.md]]
```

Lines in a note that start like a numbered or bulleted list, or a code fence, make the note read-only in the outliner; it refuses to edit such a note:

```markdown pitfall:list-in-note
- [ ] Deploy
  1. Build
  2. Upload
```

Embed paths are relative to the folder of the file with the embed line, not resolved across the vault by name as Obsidian links are. In `notes/plan.md`, `- ![[work.md]]` means `notes/work.md`.

When the outliner edits a note, it writes every note line, blank lines included, with the note's indentation, and drops blank lines at the end of the note. When it indents, outdents, or moves an item into another parent, it writes the moved lines' indentation with spaces.
