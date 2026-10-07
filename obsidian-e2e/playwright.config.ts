import { defineConfig } from '@playwright/test';

// Tests the built plugin (dist/) inside the Obsidian desktop app on macOS; `npm run test:obsidian`
// builds it first. Each test starts its own Obsidian process with a temporary profile and vault
// (see fixtures.ts), so the tests run one at a time. Not part of CI, `npm test` or `npm run test:e2e`.
export default defineConfig({
  testDir: '.',
  workers: 1,
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
});
