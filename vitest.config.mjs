import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // The other files in test/ use node:test and run with `npm run test:node`.
    include: ['test/ui/**/*.test.js'],
    setupFiles: ['test/ui/setup.js'],
  },
});
