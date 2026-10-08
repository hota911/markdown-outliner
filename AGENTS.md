# Notes for contributors and coding agents

[README.md](README.md#development) describes the commands, the tests, and the source layout. This file lists only what to check before opening a pull request.

## Before a pull request

Run what CI runs (`.github/workflows/ci.yml`):

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e   # needs Chromium: npx playwright install chromium
npm run build
```

To try a change in the browser, run `npm run demo`. It serves a temporary copy of `samples/` and prints the URL; do not edit `samples/` in place.

## Tests

- In `e2e/`, take UI labels from `t` in `e2e/fixtures.ts` (the English message catalog, `messages.en` in `src/ui/messages.ts`) instead of writing the English text. Keep role-based selectors such as `getByRole('button', { name: t.toolbar.save })`.

## Documentation

- Pull requests with user-facing changes add a Changie fragment to `.changes/unreleased/` (`npx changie new --kind <Added|Changed|Deprecated|Removed|Fixed|Security> --body "..." --interactive=false`) instead of editing CHANGELOG.md. CHANGELOG.md is generated, and `npm test` fails if it was edited by hand. A fix to a change that is not released yet edits that change's fragment instead of adding a new one. See [Changelog in README.md](README.md#changelog).
- Update the README for user-facing changes. When a Japanese README exists next to it, update it in the same pull request.
