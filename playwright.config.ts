import { defineConfig, devices } from '@playwright/test';

// Each test starts its own server.mjs instance on a temporary file (see e2e/fixtures.ts), so
// there is no shared webServer and the tests never touch samples/. The server serves the
// built page, so `npm run test:e2e` runs `npm run build:web` first.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    // The page follows navigator.language; the tests use the English labels.
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
