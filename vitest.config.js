import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // server tests (JS) + pure web utility tests (.ts only — component .tsx tests would need jsdom).
    include: ['server/**/*.test.js', 'web/src/**/*.test.ts'],
    // Integration tests boot an Express app (and sometimes import Playwright); 5s is too
    // tight on a loaded Windows box and flakes. Real failures fail regardless of timeout.
    testTimeout: 30000,
  },
});
