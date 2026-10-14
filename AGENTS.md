# Notes for contributors and coding agents

[README.md](README.md#development) describes the commands, the tests, and the source layout. This file lists only what to check before opening a pull request.

## Before a pull request

Run what CI runs (`.github/workflows/ci.yml` and `.github/workflows/perf.yml`):

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e   # needs Chromium: npx playwright install chromium
npm run test:perf
npm run build
```

When a change touches Obsidian-specific behavior or CSS (the plugin view, `src/obsidian/`, styles shown inside Obsidian, or `obsidian-e2e/`), also run `npm run test:obsidian`. On macOS it uses `/Applications/Obsidian.app` (or `OBSIDIAN_EXECUTABLE`) and runs Obsidian as a background-only app with a transparent, unfocusable window, so it does not take the user's focus; it never touches the user's own Obsidian settings or vaults. Set `OBSIDIAN_E2E_HEADED=1` only to watch a test while debugging, since Obsidian then opens in the foreground. The `Obsidian` workflow (`.github/workflows/obsidian.yml`) runs the same tests on Linux under Xvfb on every pull request, as a further check.

To try a change in the browser, run `npm run demo`. It serves a temporary copy of `samples/` and prints the URL; do not edit `samples/` in place.

## Changes

- One request, one pull request: start each feature or fix from `main`, not from the branch of another open pull request.
- Every pull request with a user-facing change should be possible to try in the pull request preview (`npm run build:preview`, linked from the pull request by the `preview` workflow). The preview only opens `samples/*.md` and runs `src/preview/main.ts`, so add or extend a sample (or the preview wiring) in the same pull request. Features that only work in Obsidian cannot be shown there; say so in the pull request.
- Behavior that differs by host goes through the `MountOptions` callbacks and the adapter (`src/ui/types.ts`); `src/ui/` has no Obsidian code. Date-dependent behavior takes today from `MountOptions.now`.
- Keyboard edits that act on a neighboring item (merging with Backspace or Delete, moving, and so on) use the nearest item on screen, after the filter, folding and zoom, and leave hidden items untouched.
- Recurring tasks (`🔁`) are handled by `src/recurrence.ts`, so they work without the Tasks plugin and outside Obsidian. Do not hand them to the Tasks plugin's API.

## Tests

- When a Playwright test drags with the mouse, measure the target again after items get selected: the selection bar appears above the outline and moves the items down.
- In `e2e/`, take UI labels from `t` in `e2e/fixtures.ts` (the English message catalog, `messages.en` in `src/ui/messages.ts`) instead of writing the English text. Keep role-based selectors such as `getByRole('button', { name: t.toolbar.save })`.

## Documentation

- Pull requests with user-facing changes add a Changie fragment to `.changes/unreleased/` (`npx changie new --kind <Added|Changed|Deprecated|Removed|Fixed|Security> --body "..." --interactive=false`) instead of editing CHANGELOG.md. CHANGELOG.md is generated, and `npm test` fails if it was edited by hand. A fix to a change that is not released yet edits that change's fragment instead of adding a new one. See [Changelog in README.md](README.md#changelog).
- Update the README for user-facing changes. When a Japanese README exists next to it, update it in the same pull request.
